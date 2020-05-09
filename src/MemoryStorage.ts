import { IReferenceStorage, Metadata } from './Interfaces';
import BPlusTree from './BPlusTree';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor() {
    this._dataMetadataId = 0;
    this._idMapMetadataId = 1;
    this._data = {};
    this._nextId = 2;
    const that = this;

    this._extIdMap = new BPlusTree<number, number>(
      10,
      {
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
      },
      undefined,
      () => {
        return that._nextId++;
      },
    );
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

  /*** PRIVATE ***/

  private readonly _dataMetadataId: number;
  private readonly _idMapMetadataId: number;
  private _nextId: number;
  private _data: any;
  private _extIdMap: BPlusTree<number, number>;
}

export default MemoryStorage;
