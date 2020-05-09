import { IReferenceStorage, Node, Entry, Pointer, Metadata } from './Interfaces';
import * as assert from 'assert';
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

  get<K, V>(id: number): Node<K, V> | undefined {
    const v1 = this._data[id].obj;
    const v2 = this.deserialize(this._data[id].cbor);
    assert.deepEqual(v1, v2);
    return v1;
    // return this.deserialize(this._data[id].cbor);
  }

  put<K, V>(id: number, ref: Node<K, V>): void {
    const cborData = this.serialize(ref);
    this._data[id] = {
      obj: ref,
      cbor: cborData,
    };

    const cborTest = this.deserialize(cborData);
    assert.deepEqual(ref, cborTest);
  }

  /*** PRIVATE ***/

  private _id: number;
  private _data: any;

  private serialize<K, V>(ref: Node<K, V>): Buffer {
    let data;
    if (ref.isLeaf) {
      data = ref.entries.map((x) => {
        return [x.key, x.value];
      });
    } else {
      data = ref.pointers.map((x) => {
        return [x.key, x.nodeId];
      });
    }

    return cbor.encode([ref.id, ref.isLeaf, data]);
  }

  private deserialize<K, V>(cborData: any): Node<K, V> {
    const decodeArray = cbor.decodeAllSync(cborData)[0];
    const refId = decodeArray[0] as number;
    const refIsLeaf = decodeArray[1] as boolean;
    const data = decodeArray[2] as any[];

    let ref: Node<K, V>;
    if (refIsLeaf) {
      ref = {
        id: refId,
        isLeaf: refIsLeaf,
        pointers: [],
        entries: data.map((x: any[]) => {
          return { key: x[0] as K, value: x[1] as V };
        }),
      };
    } else {
      ref = {
        id: refId,
        isLeaf: refIsLeaf,
        pointers: data.map((x: any[]) => {
          return { key: x[0] as K, nodeId: x[1] as number };
        }),
        entries: [],
      };
    }

    return ref;
  }
}

export default MemoryStorage;
