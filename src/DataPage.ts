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

  async DataPageToDOT(internalId: number) {
    let str = '';
    let fieldStr = '';
    let i = 0;
    let fillColor = '';
    if (this.id > 9900000) {
      fillColor = `fillcolor="${this.isLeaf ? '#ddffff' : '#ffffdd'}"`;
    } else {
      fillColor = `fillcolor="${this.isLeaf ? '#88ffff' : '#ffff88'}"`;
    }
    if (this.isLeaf) {
      fieldStr += `
  <table border="0" cellborder="1" cellspacing="0">
    <tr><td cellborder="1" bgcolor="#eeffff"><b>E${this.id}:I${internalId}</b></td></tr>
    <hr/>
    <tr><td border="0" >
      <table cellspacing='0'>
        <tr><td bgcolor="#88ffcc"><b>K</b></td><td bgcolor="#88ffcc"><b>V</b></td></tr>        `;
      this.entries.forEach((d) => {
        fieldStr += `        <tr><td>${d.key}</td><td>${d.value == null ? '*' : d.value}`;
        fieldStr += `</td></tr>\n`;
      });
      fieldStr += `
      </table>
    </td></tr>
  </table>`;
      str += `n${this.id} [${fillColor}, style=filled, label=<${fieldStr}>];\n`;
    } else {
      this.pointers.forEach((cId) => {
        str += `n${this.id}:c${i} -> n${cId.pageId}\n`;
        fieldStr += `|<c${i++}>${cId.key == null ? '*' : cId.key}`;
      });
      str += `n${this.id} [${fillColor}, style=filled, label="E${this.id}:I${internalId}${fieldStr}"]\n`;
    }
    return str;
  }

  private _isLeaf: boolean;
  pointers: Pointer<K>[];
  entries: Entry<K, V>[];
}
