import { IReferenceStorage, Metadata } from './Interfaces';
import * as cbor from 'cbor';

export class MemoryStorage implements IReferenceStorage {
  /*** PUBLIC ***/

  public constructor() {
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

  get(id: number): any | undefined {
    return this._data[id].obj;
  }

  put(id: number, ref: any): void {
    this._data[id] = {
      obj: ref,
      cbor: cbor.encode(ref),
    };
  }

  /*** PRIVATE ***/

  private _id: number;
  private _data: any;
}

export default MemoryStorage;
