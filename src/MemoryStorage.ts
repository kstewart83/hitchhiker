import { IReferenceStorage, IReference } from './Interfaces';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor() {
    this._id = 0;
    this._data = {};
  }

  newId(): number {
    return this._id++;
  }

  putMetadata(meta: any): void {
    this._data.meta = meta;
  }

  getMetadata(): any {
    return this._data.meta;
  }

  get(id: number): any | undefined {
    return this._data[id];
  }
  put(id: number, ref: any): void {
    this._data[id] = ref;
  }

  /*** PRIVATE ***/

  private _id: number;
  private _data: any;
}

export default MemoryStorage;
