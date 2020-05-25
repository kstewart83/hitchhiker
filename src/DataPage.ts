import Page, { PageType } from './Page';
import { Pointer, Entry } from './Interfaces';
import * as cbor from 'cbor';
import { SHA3 } from 'sha3';

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

  upsertEntry(key: K, value?: V): { index: number; found: boolean } {
    const { index, found } = this.getChildIndex(key);

    // if key already exists, overwrite existing value
    if (found) {
      this.entries[index].value = value;
    } else {
      // otherwise, insert key/value pair based on the returned index
      this.entries.splice(index, 0, { key, value });
    }

    return { index, found };
  }

  deleteEntry(key: K): { found: boolean; value?: V } {
    const { index, found } = this.getChildIndex(key);

    // if key exists, remove entry
    if (found) {
      const entry = this.entries.splice(index, 1)[0];
      return { found, value: entry.value };
    } else {
      return { found, value: undefined };
    }
  }

  getChildIndex(key: K): { index: number; found: boolean } {
    let comparison: number;
    let index: number;
    if (this.isLeaf) {
      if (this.entries.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, 0, this.entries.length - 1);
      comparison = this.compareKey(key, this.entries[index].key);
    } else {
      if (this.pointers.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, 0, this.pointers.length - 2);
      const otherKey = this.pointers[index].key;
      comparison = this.compareKey(key, otherKey);
    }

    if (comparison === 0) {
      return { index, found: true };
    } else if (comparison < 0) {
      return { index, found: false };
    } else {
      return { index: index + 1, found: false };
    }
  }

  private getChildIndexBinarySearch(key: K, start: number, end: number): number {
    if (start === end) {
      return start;
    }

    const mid = Math.floor((start + end) / 2);
    let otherKey;
    if (this.isLeaf) {
      otherKey = this.entries[mid].key;
    } else {
      otherKey = this.pointers[mid].key;
    }
    const comparison = this.compareKey(key, otherKey);

    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      return this.getChildIndexBinarySearch(key, start, Math.max(start, mid - 1));
    } else {
      return this.getChildIndexBinarySearch(key, Math.min(end, mid + 1), end);
    }
  }

  private compareKey(a?: K | null, b?: K | null): number {
    if (a == null || b == null) {
      throw new Error('Key is null');
    }

    if (a === undefined || b === undefined) {
      throw new Error('Key is undefined');
    }

    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else {
      return 0;
    }
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

  async setHash() {
    if (this.serialization === undefined) {
      this.serialization = await this.serializeDataPage();
    }

    const hash = new SHA3(256);
    hash.update(this.serialization);
    this.hash = hash.digest().slice(0, 16);
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
