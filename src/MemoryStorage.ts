import { IReferenceStorage } from './Interfaces';
import BPlusTree from './BPlusTree';
import { FreePage } from './FreePage';
import { Page, PageType } from './Page';

enum TreeType {
  Data = 1,
  Id = 2,
  Free = 3,
}

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public readonly DataMetadataId = 0;
  public readonly IdMapMetadataId = 1;
  public readonly FreeMapMetadataId = 2;

  public constructor(nodeSize: number = 64) {
    this._maxNodeSize = nodeSize;
    this._data = {};
    this._nextId = 3;
    const that = this;
    this._pendingFreePageIds = [];

    this._freeMapNextId = async (): Promise<number> => {
      return that._nextId++;
    };

    const internalFreeBTreeMethods = {
      maxPageSize() {
        return that._maxNodeSize;
      },
      async getMetadata() {
        return await that.getInternal(that.FreeMapMetadataId);
      },
      async putMetadata(meta: Buffer) {
        await that.putInternal(that.FreeMapMetadataId, meta);
      },
      async get(id: number) {
        return await that.getInternal(id);
      },
      async put(id: number, ref: Buffer) {
        await that.putInternal(id, ref);
      },
      async free(id: number) {
        await that.freeInternal(id, id, TreeType.Free);
      },
      generator(): Generator<
        {
          key: number;
          buffer: Buffer;
        },
        boolean,
        number
      > {
        return that.generator();
      },
    };

    this._freeMap = new BPlusTree<number, number>(internalFreeBTreeMethods, async () => {
      return await that._freeMapNextId();
    });

    (async () => {
      await that._freeMap.blockOnSetup();
      that._freeMapNextId = async () => {
        return await that.getNextFreeId(TreeType.Free);
      };
    })();

    const internalIdBTreeMethods = {
      maxPageSize() {
        return that._maxNodeSize;
      },
      async getMetadata() {
        return await that.getInternal(that.IdMapMetadataId);
      },
      async putMetadata(meta: Buffer) {
        await that.putInternal(that.IdMapMetadataId, meta);
      },
      async get(id: number) {
        return await that.getInternal(id);
      },
      async put(id: number, ref: Buffer) {
        await that.putInternal(id, ref);
      },
      async free(id: number): Promise<void> {
        await that.freeInternal(id, id, TreeType.Id);
      },
      generator(): Generator<
        {
          key: number;
          buffer: Buffer;
        },
        boolean,
        number
      > {
        return that.generator();
      },
    };

    this._extIdMap = new BPlusTree<number, number>(internalIdBTreeMethods, async () => {
      return await that.getNextFreeId(TreeType.Id);
    });
  }

  maxPageSize(): number {
    return this._maxNodeSize;
  }

  async putMetadata(meta: Buffer): Promise<void> {
    await this.putInternal(this.DataMetadataId, meta);
  }

  async getMetadata(): Promise<Buffer | undefined> {
    return await this.getInternal(this.DataMetadataId);
  }

  async get(extId: number): Promise<Buffer | undefined> {
    const intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    return await this.getInternal(intId);
  }

  async put(extId: number, ref: Buffer): Promise<void> {
    let intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      intId = await this.getNextFreeId(TreeType.Data);
      await this._extIdMap.add(extId, intId);
    }
    await this.putInternal(intId, ref);
  }

  async free(extId: number): Promise<void> {
    const intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    await this.freeInternal(intId, extId, TreeType.Data);
    await this._extIdMap.delete(extId);
  }

  *generator(count?: number) {
    function* entries(obj: { [key: number]: Buffer }) {
      for (const key of Object.keys(obj)) {
        const k = parseInt(key, 10);
        yield {
          key: k,
          value: obj[k],
        };
      }
    }

    const keys = entries(this._data);

    let i = 0;
    let nextEntry = keys.next();
    while (!nextEntry.done) {
      yield {
        key: nextEntry.value.key,
        buffer: nextEntry.value.value,
      };
      if (count && i++ > count) {
        return false;
      }
      nextEntry = keys.next();
    }
    return true;
  }

  /*** PRIVATE ***/

  private readonly _maxNodeSize: number;
  private _nextId: number;
  private _data: { [key: number]: Buffer };
  private _extIdMap: BPlusTree<number, number>;
  private _freeMap: BPlusTree<number, number>;
  private _freeMapNextId: () => Promise<number>;
  private _pendingFreePageIds: number[];

  private async getNextFreeId(context: TreeType): Promise<number> {
    if (this._nextId <= 6) {
      return this._nextId++;
    }

    if (this._pendingFreePageIds.length > 0) {
      this._pendingFreePageIds.sort((a, b) => a - b);
      const next = this._pendingFreePageIds.shift();
      if (next === undefined) {
        throw new Error('Pending operations should have at least one element');
      }
      return next;
    }

    if (this._freeMap.isOperationPending()) {
      return this._nextId++;
    }

    const nextId = await this._freeMap.findNext(0);

    if (nextId) {
      if (context === TreeType.Free) {
        const val = await this._freeMap.find(nextId);
        if (val === undefined) {
          throw new Error();
        }
      }
      const buf = await this.getInternal(nextId);
      if (buf === undefined) {
        throw new Error('Not a valid ID');
      }
      const page = await Page.deserializePage(buf);
      if (page.refType === PageType.Free) {
        const freePage = FreePage.deserializeFreePage(page.refId, page.data);
        if (freePage.detached) {
          throw new Error('Page should not already be detached');
        } else {
          freePage.detached = true;
          freePage.serialization = await freePage.serializeFreePage();
          await this.putInternal(nextId, freePage.serialization);
        }
      } else {
        throw new Error('Page not marked as free');
      }
      await this._freeMap.delete(nextId);
      return nextId;
    } else {
      return this._nextId++;
    }
  }

  private async freeInternal(id: number, oldId: number, context: TreeType) {
    const freePage = new FreePage(id, false);
    if (this._freeMap.isOperationPending()) {
      freePage.detached = true;
      this._pendingFreePageIds.push(id);
    } else {
      await this._freeMap.add(id, oldId);
    }
    freePage.serialization = await freePage.serializeFreePage();
    await this.putInternal(id, freePage.serialization);
  }

  private async getInternal(id: number): Promise<Buffer | undefined> {
    return this._data[id];
  }

  private async putInternal(id: number, ref: Buffer) {
    this._data[id] = ref;
  }
}

export default MemoryStorage;
