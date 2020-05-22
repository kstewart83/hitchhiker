import { IReferenceStorage, PathElement } from './Interfaces';
import { Page, PageType } from './Page';
import { DataPage } from './DataPage';
import { MetaPage } from './MetaPage';
import MemoryStorage from './MemoryStorage';
import * as cbor from 'cbor';
import { SHA3 } from 'sha3';

export class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each page.
   * @param comparator Custom compartor for key values
   */
  public constructor(storage?: IReferenceStorage, comparator?: (a: K, b: K) => number, idGenerator?: () => number) {
    this._fillFactor = 4;
    this._root = undefined;
    this._metadata = undefined;
    this._setupComplete = false;
    if (storage) {
      this._storage = storage;
    } else {
      this._storage = new MemoryStorage();
    }
    this._maxPageSize = this._storage.maxPageSize();
    if (idGenerator === undefined) {
      let baseId = 900000;
      this._idGenerator = () => {
        return baseId++;
      };
    } else {
      this._idGenerator = idGenerator;
    }
    this._comparator = comparator;
    (async () => {
      await this.setup();
    })();
  }

  /**
   * This function searches the tree for the value associated with the search key.
   *
   * @param key Key to search for in tree
   * @returns Value associated with search key if it exists (can be null) or undefined
   * if search key is not in tree
   */
  public async find(key: K): Promise<V | undefined> {
    if (!this._setupComplete) {
      await this.blockOnSetup();
    }
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }
    const { leaf } = await this.findLeaf(key, [], this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    if (found) {
      return leaf.entries[index].value;
    } else {
      return undefined;
    }
  }

  /**
   * This function adds the key/value pair to the tree, overwriting values for keys
   * that already exist
   *
   * @param key Key to add to tree
   * @param value Value to add to the key in tree (can be null)
   */
  public async add(key: K, value?: V) {
    if (!this._setupComplete) {
      await this.blockOnSetup();
    }
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }
    const { path, leaf } = await this.findLeaf(key, [], this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    // if key already exists, overwrite existing value
    if (found) {
      leaf.entries[index].value = value;
      await this.storeDataPage(leaf, path);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    leaf.entries.splice(index, 0, { key, value });
    await this.storeDataPage(leaf, path);
  }

  /**
   * This function deletes the key/value pair from the tree
   *
   * @param key Key to delete from tree
   */
  public async delete(key: K): Promise<V | undefined> {
    if (!this._setupComplete) {
      await this.blockOnSetup();
    }
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }
    const { path, leaf } = await this.findLeaf(key, [], this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    // if key exists, remove entry
    if (found) {
      const entry = leaf.entries.splice(index, 1)[0];
      await this.storeDataPage(leaf, path);
      return entry.value;
    } else {
      return undefined;
    }
  }

  /**
   * Convert tree to DOT representation
   */
  public async toDOT(): Promise<string> {
    let str = '';
    const gen = this._storage.generator();
    let next = gen.next();
    while (!next.done) {
      const nextResult = next.value;
      const page = await Page.deserializePage(nextResult.buffer);

      if (page.refType === PageType.Data) {
        const dataPage = DataPage.deserializeDataPage<K, V>(page.refId, page.data);
        str += await dataPage.DataPageToDOT(next.value.key);
      } else if (page.refType === PageType.Meta) {
        const metaPage = MetaPage.deserializeMetaPage(page.refId, page.data);
        str += await metaPage.metaPageToDOT(next.value.key, this._storage);
      } else {
        throw new Error('Unknown Page Type');
      }

      next = gen.next();
    }

    return str;
  }

  /*** PRIVATE ***/

  private _setupComplete: boolean;
  private _root: DataPage<K, V> | undefined;
  private _comparator?: (a: K, b: K) => number;
  private _storage: IReferenceStorage;
  private _metadata: MetaPage | undefined;
  private _idGenerator: () => number;
  private readonly _fillFactor: number;
  private readonly _maxPageSize: number;

  private async blockOnSetup() {
    while (!this._setupComplete) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  private async setup() {
    const metadata = await this.loadMetadata();
    if (metadata) {
      this._metadata = metadata;
      this._root = await this.loadDataPage(metadata.rootId);
    } else {
      this._root = new DataPage(this._idGenerator(), true, [], []);
      await this.storeDataPage(this._root);
      this._metadata = new MetaPage(0, this._root.id);
      await this.storeMetadata();
    }
    this._setupComplete = true;
  }

  private async setHash(page: Page) {
    if (page.serialization === undefined) {
      if (page.type === PageType.Data) {
        page.serialization = await (page as DataPage<K, V>).serializeDataPage();
      } else if (page.type === PageType.Meta) {
        page.serialization = await (page as MetaPage).serializeMetaPage();
      } else {
        throw new Error('Unknown page type');
      }
    }

    const hash = new SHA3(256);
    hash.update(page.serialization);
    page.hash = hash.digest().slice(0, 16);
  }

  private async storeMetadata() {
    if (this._metadata === undefined) {
      throw new Error('Root is not defined');
    }
    const pageBuf = await this._metadata.serializeMetaPage();
    await this._storage.putMetadata(pageBuf);
  }

  private async storeDataPage(page: DataPage<K, V>, path?: PathElement<K, V>[]) {
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }

    page.serialization = await page.serializeDataPage();

    // if adding a new item fills the page, split it
    if (page.serialization.length > this._maxPageSize) {
      // overflow, need to split
      if (path === undefined) {
        throw new Error('Must provide path if page exceeds max size');
      }
      await this.split(page, path);
    } else if (this._root.id === page.id && this._root.pointers.length === 1) {
      // root is down to one child, need to consolidate into new root as leaf
      const oldRootId = this._root.id;
      const onlyChild = await this.loadDataPage(page.pointers[0].pageId);
      this._root = onlyChild;
      this._metadata = new MetaPage(0, onlyChild.id);
      await this.storeMetadata();
      await this._storage.free(oldRootId);
    } else if (this._root.id !== page.id && page.serialization.length < this._maxPageSize / this._fillFactor) {
      // a page as underflowed, need to borrow/merge with siblings
      if (path === undefined) {
        throw new Error('Must provide path if page is less than minimum size');
      }
      await this.underflow(page, path);
    } else {
      await this.setHash(page);
      await this._storage.put(page.id, page.serialization);
      page.serialization = undefined;
    }
  }

  private async underflow(page: DataPage<K, V>, path: PathElement<K, V>[]) {
    const parentElement = path[path.length - 1];
    const upperSiblingId = parentElement.page.pointers[parentElement.index + 1];
    const lowerSiblingId = parentElement.page.pointers[parentElement.index - 1];
    let upper: DataPage<K, V>;
    let lower: DataPage<K, V>;
    if (upperSiblingId) {
      const upperSibling = await this.loadDataPage(upperSiblingId.pageId);
      lower = page;
      upper = upperSibling;
    } else if (lowerSiblingId) {
      const lowerSibling = await this.loadDataPage(lowerSiblingId.pageId);
      lower = lowerSibling;
      upper = page;
    } else {
      throw new Error('Underflow pages should have at least one sibling');
    }

    lower.serialization = await lower.serializeDataPage();
    upper.serialization = await upper.serializeDataPage();

    const fillRatio = this._maxPageSize / this._fillFactor;
    let onlyOneChild = false;

    if (lower.serialization.length < fillRatio) {
      // need to flow elements high to low

      while (lower.serialization.length < fillRatio && upper.serialization.length >= fillRatio) {
        if (page.isLeaf) {
          const next = upper.entries.shift();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          lower.entries.push(next);
          const parentEntry = upper.entries[0];
          if (parentEntry === undefined) {
            lower.serialization = await lower.serializeDataPage();
            upper.serialization = await upper.serializeDataPage();
            break;
          }
          parentElement.page.pointers[parentElement.index].key = parentEntry.key;
        } else {
          const next = upper.pointers.shift();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          lower.pointers[lower.pointers.length - 1].key = parentElement.page.pointers[parentElement.index].key;
          parentElement.page.pointers[parentElement.index].key = next.key;
          next.key = null;
          lower.pointers.push(next);
          onlyOneChild = upper.pointers.length <= 1;
        }

        lower.serialization = await lower.serializeDataPage();
        upper.serialization = await upper.serializeDataPage();
      }

      if (upper.serialization.length < fillRatio || onlyOneChild) {
        this.merge(page, lower, upper, path);
      }
    } else if (upper.serialization.length < fillRatio) {
      // need to flow elements low to high
      while (upper.serialization.length < fillRatio && lower.serialization.length >= fillRatio) {
        if (page.isLeaf) {
          const next = lower.entries.pop();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          upper.entries.unshift(next);
          const parentKey = upper.entries[0].key;
          if (page.id === upper.id) {
            parentElement.page.pointers[parentElement.index - 1].key = parentKey;
          } else {
            parentElement.page.pointers[parentElement.index].key = parentKey;
          }
        } else {
          const next = lower.pointers.pop();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }

          let parentIndex: number;
          if (page.id === upper.id) {
            parentIndex = parentElement.index - 1;
          } else {
            parentIndex = parentElement.index;
          }
          next.key = parentElement.page.pointers[parentIndex].key;
          parentElement.page.pointers[parentIndex].key = lower.pointers[lower.pointers.length - 1].key;
          if (lower.pointers.length > 1) {
            lower.pointers[lower.pointers.length - 1].key = null;
          } else {
            onlyOneChild = true;
          }
          upper.pointers.unshift(next);
        }

        lower.serialization = await lower.serializeDataPage();
        upper.serialization = await upper.serializeDataPage();
      }

      if (lower.serialization.length < fillRatio || onlyOneChild) {
        this.merge(page, lower, upper, path);
      }
    } else {
      throw new Error('Siblings should not be of equal length');
    }

    const parentPath = [...path];
    parentPath.pop();

    if (lower.entries.length === 0 && lower.pointers.length === 0) {
      await this._storage.free(lower.id);
    } else {
      await this.storeDataPage(lower);
    }

    if (upper.entries.length === 0 && upper.pointers.length === 0) {
      await this._storage.free(upper.id);
    } else {
      await this.storeDataPage(upper);
    }
    await this.storeDataPage(parentElement.page, parentPath);
  }

  private merge(page: DataPage<K, V>, lower: DataPage<K, V>, upper: DataPage<K, V>, path: PathElement<K, V>[]) {
    const parentElement = path[path.length - 1];
    let parentIndex: number;

    if (page.id === upper.id) {
      parentIndex = parentElement.index - 1;
    } else {
      parentIndex = parentElement.index;
    }

    if (page.isLeaf) {
      upper.entries.unshift(...lower.entries);
      lower.entries = [];
    } else {
      lower.pointers[lower.pointers.length - 1].key = parentElement.page.pointers[parentIndex].key;
      upper.pointers.unshift(...lower.pointers);
      lower.pointers = [];
    }

    parentElement.page.pointers.splice(parentIndex, 1);
  }

  private async loadPage(id: number): Promise<Page> {
    const result = await this._storage.get(id);
    if (result === undefined) {
      throw new Error('Page not in storage');
    }

    const page = await Page.deserializePage(result);

    if (page.refType === PageType.Data) {
      return DataPage.deserializeDataPage(page.refId, page.data);
    } else if (page.refType === PageType.Meta) {
      return MetaPage.deserializeMetaPage(page.refId, page.data);
    }

    throw new Error('Unknown page type');
  }

  private async loadDataPage(id: number): Promise<DataPage<K, V>> {
    const result = await this._storage.get(id);
    if (result === undefined) {
      throw new Error('Page not in storage');
    }

    const page = await Page.deserializePage(result);

    if (page.refType === PageType.Data) {
      return DataPage.deserializeDataPage(page.refId, page.data);
    }

    throw new Error('Page ID not associated with metapage');
  }

  private async loadMetadata(): Promise<MetaPage | undefined> {
    const result = await this._storage.getMetadata();
    if (result === undefined) {
      return result;
    }
    this._metadata = cbor.decode(result) as MetaPage;
    return this._metadata;
  }

  private async findLeaf(
    key: K,
    path: PathElement<K, V>[],
    page: DataPage<K, V>,
  ): Promise<{ path: PathElement<K, V>[]; leaf: DataPage<K, V> }> {
    if (page.isLeaf) {
      return { path, leaf: page };
    } else {
      const { index, found } = this.getChildIndex(key, page);

      const childId = page.pointers[index + (found ? 1 : 0)];
      const child = await this.loadDataPage(childId.pageId);
      return await this.findLeaf(
        key,
        path.concat({
          page,
          index: index + (found ? 1 : 0),
          found,
        }),
        child,
      );
    }
  }

  private getChildIndex(key: K, page: DataPage<K, V>): { index: number; found: boolean } {
    let comparison: number;
    let index: number;
    if (page.isLeaf) {
      if (page.entries.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, page, 0, page.entries.length - 1);
      comparison = this.compareKey(key, page.entries[index].key);
    } else {
      if (page.pointers.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, page, 0, page.pointers.length - 2);
      const otherKey = page.pointers[index].key;
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

  private getChildIndexBinarySearch(key: K, page: DataPage<K, V>, start: number, end: number): number {
    if (start === end) {
      return start;
    }

    const mid = Math.floor((start + end) / 2);
    let otherKey;
    if (page.isLeaf) {
      otherKey = page.entries[mid].key;
    } else {
      otherKey = page.pointers[mid].key;
    }
    const comparison = this.compareKey(key, otherKey);

    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      return this.getChildIndexBinarySearch(key, page, start, Math.max(start, mid - 1));
    } else {
      return this.getChildIndexBinarySearch(key, page, Math.min(end, mid + 1), end);
    }
  }

  private async split(page: DataPage<K, V>, path: PathElement<K, V>[]) {
    let midKey: K | null;
    let midIndex: number;
    if (page.isLeaf) {
      midIndex = Math.floor((page.entries.length - (page.isLeaf ? 0 : 1)) / 2);
      midKey = page.entries[midIndex].key;
    } else {
      midIndex = Math.floor((page.pointers.length - (page.isLeaf ? 0 : 1)) / 2);
      midKey = page.pointers[midIndex].key;
    }

    if (midKey == null) {
      throw new Error('Key is null');
    }

    const newPage: DataPage<K, V> = new DataPage(
      this._idGenerator(),
      page.isLeaf,
      page.pointers.slice(midIndex),
      page.entries.slice(midIndex),
    );
    page.pointers = page.pointers.slice(0, midIndex);
    page.entries = page.entries.slice(0, midIndex);

    if (!page.isLeaf) {
      const newPageChildId = newPage.pointers.shift();
      if (newPageChildId === undefined) {
        throw new Error('Trying to split empty internal page');
      }
      const newPageChild = await this.loadPage(newPageChildId.pageId);
      page.pointers.push({ key: null, pageId: newPageChild.id });
    }

    await this.storeDataPage(newPage, path);
    await this.storeDataPage(page, path);

    if (path.length > 0) {
      const parent = path[path.length - 1].page;
      const { index } = this.getChildIndex(midKey, parent);
      parent.pointers.splice(index, 0, { key: midKey, pageId: page.id });
      parent.pointers[index + 1].pageId = newPage.id;

      const newPath = [...path].slice(0, path.length - 1);
      await this.storeDataPage(parent, newPath);
    } else {
      this._root = new DataPage(
        this._idGenerator(),
        false,
        [
          { key: midKey, pageId: page.id },
          { key: null, pageId: newPage.id },
        ],
        [],
      );

      await this.storeDataPage(this._root);
      this._metadata = new MetaPage(0, this._root.id);
      await this.storeMetadata();
    }
  }

  private compareKey(a?: K | null, b?: K | null): number {
    if (a == null || b == null) {
      throw new Error('Key is null');
    }

    if (a === undefined || b === undefined) {
      throw new Error('Key is undefined');
    }

    if (this._comparator) {
      return this._comparator(a, b);
    } else {
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      } else {
        return 0;
      }
    }
  }
}

export default BPlusTree;
