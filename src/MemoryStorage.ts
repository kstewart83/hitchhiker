import { IReferenceStorage } from './Interfaces';
import BPlusTree from './BPlusTree';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public readonly DataMetadataId = 0;
  public readonly IdMapMetadataId = 1;

  public constructor() {
    this._maxNodeSize = 64;
    this._data = {};
    this._nextId = 2;
    const that = this;

    const internalBTreeMethods = {
      maxNodeSize() {
        return that._maxNodeSize;
      },
      async getMetadata() {
        return that._data[that.IdMapMetadataId];
      },
      async putMetadata(meta: Buffer) {
        that._data[that.IdMapMetadataId] = meta;
      },
      async get(id: number) {
        return that._data[id];
      },
      async put(id: number, ref: Buffer) {
        that._data[id] = ref;
      },
      async free(id: number): Promise<void> {
        delete that._data[id];
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

    this._extIdMap = new BPlusTree<number, number>(internalBTreeMethods, undefined, () => {
      return that._nextId++;
    });
  }

  maxNodeSize(): number {
    return this._maxNodeSize;
  }

  async putMetadata(meta: Buffer): Promise<void> {
    this._data[this.DataMetadataId] = meta;
  }

  async getMetadata(): Promise<Buffer | undefined> {
    return this._data[this.DataMetadataId];
  }

  async get(extId: number): Promise<Buffer | undefined> {
    const intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    return this._data[intId];
  }

  async put(extId: number, ref: Buffer): Promise<void> {
    let intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      intId = this._nextId++;
      await this._extIdMap.add(extId, intId);
    }
    this._data[intId] = ref;
  }

  async free(extId: number): Promise<void> {
    const intId = await this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    delete this._data[intId];
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
}

export default MemoryStorage;
