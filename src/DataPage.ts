import Page, { PageType } from './Page';
import { Pointer, Entry } from './Interfaces';

export class DataPage<K, V> extends Page {
  isLeaf: boolean;
  pointers: Pointer<K>[];
  entries: Entry<K, V>[];

  constructor(id: number, isLeaf: boolean, pointers: Pointer<K>[], entries: Entry<K, V>[]) {
    super(id, PageType.Data);
    this.isLeaf = isLeaf;
    this.pointers = pointers;
    this.entries = entries;
  }
}
