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
      getMetadata() {
        return that._data[that.IdMapMetadataId];
      },
      putMetadata(meta: Buffer) {
        that._data[that.IdMapMetadataId] = meta;
      },
      get(id: number) {
        return that._data[id];
      },
      put(id: number, ref: Buffer) {
        that._data[id] = ref;
      },
      free(id: number): Buffer | undefined {
        const ref = that._data[id];
        delete that._data[id];
        return ref;
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

  putMetadata(meta: Buffer): void {
    this._data[this.DataMetadataId] = meta;
  }

  getMetadata(): Buffer | undefined {
    return this._data[this.DataMetadataId];
  }

  get(extId: number): Buffer | undefined {
    const intId = this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    return this._data[intId];
  }

  put(extId: number, ref: Buffer): void {
    let intId = this._extIdMap.find(extId);
    if (intId === undefined) {
      intId = this._nextId++;
      this._extIdMap.add(extId, intId);
    }
    this._data[intId] = ref;
  }

  free(extId: number): Buffer | undefined {
    const intId = this._extIdMap.find(extId);
    if (intId === undefined) {
      throw new Error('No internal key exists for external key');
    }
    const ref = this._data[intId];
    delete this._data[intId];
    this._extIdMap.delete(extId);
    return ref;
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
