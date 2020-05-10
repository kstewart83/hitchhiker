import { IReferenceStorage, Metadata } from './Interfaces';
import BPlusTree from './BPlusTree';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor() {
    this._maxNodeSize = 50;
    this._dataMetadataId = 0;
    this._idMapMetadataId = 1;
    this._data = {};
    this._nextId = 2;
    const that = this;

    this._extIdMap = new BPlusTree<number, number>(
      {
        maxNodeSize() {
          return that._maxNodeSize;
        },
        getMetadata() {
          return that._data[that._idMapMetadataId];
        },
        putMetadata(meta: Buffer) {
          that._data[that._idMapMetadataId] = meta;
        },
        get(id: number) {
          return that._data[id];
        },
        put(id: number, ref: Buffer) {
          that._data[id] = ref;
        },
        generator() {
          throw new Error('Not Implemented');
        },
      },
      undefined,
      () => {
        return that._nextId++;
      },
    );
  }

  maxNodeSize(): number {
    return this._maxNodeSize;
  }

  putMetadata(meta: Buffer): void {
    this._data[this._dataMetadataId] = meta;
  }

  getMetadata(): Buffer | undefined {
    return this._data[this._dataMetadataId];
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
      if (nextEntry.value.key !== this._dataMetadataId && nextEntry.value.key !== this._idMapMetadataId) {
        yield {
          key: nextEntry.value.key,
          buffer: nextEntry.value.value,
        };
      }
      if (count && i++ > count) {
        return false;
      }
      nextEntry = keys.next();
    }
    return true;
  }

  /*** PRIVATE ***/

  private readonly _dataMetadataId: number;
  private readonly _idMapMetadataId: number;
  private readonly _maxNodeSize: number;
  private _nextId: number;
  private _data: { [key: number]: Buffer };
  private _extIdMap: BPlusTree<number, number>;
}

export default MemoryStorage;
