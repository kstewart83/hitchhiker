import Page, { PageType } from './Page';
import { Pointer, Entry } from './Interfaces';
import * as cbor from 'cbor';

export class DataPage<K, V> extends Page {
  get isLeaf(): boolean {
    return this._isLeaf;
  }

  constructor(id: number, isLeaf: boolean, pointers: Pointer<K>[], entries: Entry<K, V>[]) {
    super(id, PageType.Data);
    this._isLeaf = isLeaf;
    this.pointers = pointers;
    this.entries = entries;
  }

  async serializeDataPage(): Promise<Buffer> {
    let data: any[];
    if (this.isLeaf) {
      data = this.entries.map((x) => {
        return [x.key, x.value];
      });
    } else {
      data = this.pointers.map((x) => {
        return [x.key, x.pageId];
      });
    }
    data.unshift(this.isLeaf);

    return cbor.encode(this.id, this.type, data);
  }

  static deserializeDataPage<K, V>(id: number, data: any): DataPage<K, V> {
    let ref: DataPage<K, V>;
    const isLeaf = data.shift();
    if (isLeaf) {
      ref = new DataPage(
        id,
        isLeaf,
        [],
        data.map((x: any[]) => {
          return { key: x[0] as K, value: x[1] as V };
        }),
      );
      return ref;
    } else {
      ref = new DataPage(
        id,
        isLeaf,
        data.map((x: any[]) => {
          return { key: x[0] as K, pageId: x[1] as number };
        }),
        [],
      );
    }
    return ref;
  }

  private _isLeaf: boolean;
  pointers: Pointer<K>[];
  entries: Entry<K, V>[];
}
