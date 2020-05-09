import { IReferenceStorage, Metadata } from './Interfaces';
import BPlusTree from '.';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor(externalIdTracking: boolean = false) {
    if (externalIdTracking) {
      this._extIdMap = new BPlusTree<number, number>(5, new MemoryStorage());
    }
    this._id = 0;
    this._data = {};
  }

  newId(): number {
    return this._id++;
  }

  putMetadata(meta: Metadata): void {
    this._data.meta = meta;
  }

  getMetadata(): Metadata {
    return this._data.meta;
  }

  get(id: number): Buffer | undefined {
    return this._data[id];
  }

  put(id: number, ref: Buffer): void {
    this._data[id] = ref;
  }

  /*** PRIVATE ***/

  private _id: number;
  private _data: any;
  private _extIdMap: BPlusTree<number, number> | undefined;
}

export default MemoryStorage;
