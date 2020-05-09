import { IReferenceStorage, Metadata } from './Interfaces';
import BPlusTree from '.';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor(externalIdTracking: boolean = false) {
    if (externalIdTracking) {
      this._extIdMap = new BPlusTree<number, number>(5, new MemoryStorage());
    }
    this._metadataId = 0;
    this._id = 1;
    this._data = {};
  }

  newId(): number {
    return this._id++;
  }

  putMetadata(meta: Buffer): void {
    this.put(this._metadataId, meta);
  }

  getMetadata(): Buffer | undefined {
    return this.get(this._metadataId);
  }

  get(id: number): Buffer | undefined {
    return this._data[id];
  }

  put(id: number, ref: Buffer): void {
    this._data[id] = ref;
  }

  /*** PRIVATE ***/

  private readonly _metadataId: number;
  private _id: number;
  private _data: any;
  private _extIdMap: BPlusTree<number, number> | undefined;
}

export default MemoryStorage;
