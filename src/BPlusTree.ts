import { IStorageDriver, IStorage } from './Interfaces';
import { Page, PageType } from './Page';
import { DataPage } from './DataPage';
import { MetaPage } from './MetaPage';
import DefaultStorageDriver from './DefaultStorageDriver';
import { FreePage } from './FreePage';

interface PathElement<K, V> {
  page: DataPage<K, V>;
  index: number;
  found: boolean;
}

export class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each page.
   * @param comparator Custom compartor for key values
   */
  public constructor(storageDriver?: IStorageDriver, idGenerator?: () => Promise<number>) {
    this._fillFactor = 4;
    this._root = undefined;
    this._metadata = undefined;
    this._setupComplete = false;
    this._operationPending = false;
    if (storageDriver) {
      this._storage = storageDriver;
    } else {
      this._storage = new DefaultStorageDriver();
    }
    this._maxPageSize = this._storage.maxPageSize();
    if (idGenerator === undefined) {
      let baseId = 900000;
      this._idGenerator = async () => {
        return baseId++;
      };
    } else {
      this._idGenerator = idGenerator;
    }
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
    const { index, found } = leaf.getChildIndex(key);

    if (found) {
      return leaf.entries[index].value;
    } else {
      return undefined;
    }
  }

  /**
   * This function searches the tree for the key after the search key. If the search key
   * is found, then it is returned. Otherwise, it returns the key that is next in sort
   * order. If no keys exist above the provided search key, then it returns undefined.
   *
   * @param key Key to search for in tree
   * @returns Key after search key if it exists (can be null) or undefined
   */
  public async findNext(key: K): Promise<K | undefined> {
    if (!this._setupComplete) {
      await this.blockOnSetup();
    }
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }
    const { path, leaf } = await this.findLeaf(key, [], this._root);
    const { index, found } = leaf.getChildIndex(key);

    if (found) {
      return key;
    } else {
      if (leaf.entries.length > index) {
        return leaf.entries[index].key;
      } else {
        if (leaf.id === this._root.id) {
          return undefined;
        } else {
          // get upper sibling and return first child
          throw new Error('Not implemented');
        }
      }
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
    if (this._operationPending) {
      throw new Error('Not implemented');
    }
    this._operationPending = true;
    const { path, leaf } = await this.findLeaf(key, [], this._root);
    leaf.upsertEntry(key, value);
    await this.storeDataPage(leaf, path);
    this._operationPending = false;
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
    if (this._operationPending) {
      throw new Error('Not implemented');
    }
    this._operationPending = true;
    const { path, leaf } = await this.findLeaf(key, [], this._root);
    const { found, value } = leaf.deleteEntry(key);
    if (found) {
      await this.storeDataPage(leaf, path);
    }
    this._operationPending = false;
    return value;
  }

  /**
   * This function continually awaits for setup to be complete.
   */
  public async blockOnSetup() {
    while (!this._setupComplete) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  /**
   * Return true when a mutating operating is already occurring.
   */
  public isOperationPending() {
    return this._operationPending;
  }

  /**
   * Convert tree to DOT representation
   */
  public static async toDOT(storage: IStorageDriver): Promise<string> {
    let str = '';
    const gen = storage.generator();
    let next = gen.next();
    while (!next.done) {
      const nextResult = next.value;
      const page = await Page.deserializePage(nextResult.buffer);

      if (page.refType === PageType.Data) {
        const dataPage = DataPage.deserializeDataPage(page.refId, page.data);
        str += await dataPage.DataPageToDOT(next.value.key);
      } else if (page.refType === PageType.Meta) {
        const metaPage = MetaPage.deserializeMetaPage(page.refId, page.data);
        str += await metaPage.metaPageToDOT(next.value.key, storage);
      } else if (page.refType === PageType.Free) {
        const freePage = FreePage.deserializeFreePage(page.refId, page.data);
        str += await freePage.freePageToDOT(next.value.key, storage);
      } else {
        throw new Error('Unknown Page Type');
      }

      next = gen.next();
    }

    return str;
  }

  /**
   * Convert tree to DOT representation
   */
  public async toDOT(): Promise<string> {
    return await BPlusTree.toDOT(this._storage);
  }

  /*** PRIVATE ***/

  private _setupComplete: boolean;
  private _root: DataPage<K, V> | undefined;
  private _storage: IStorageDriver;
  private _metadata: MetaPage | undefined;
  private _idGenerator: () => Promise<number>;
  private readonly _fillFactor: number;
  private readonly _maxPageSize: number;
  private _operationPending: boolean;

  private async setup() {
    const metadata = await this.loadMetadata();
    if (metadata) {
      this._metadata = metadata;
      this._root = await this.loadDataPage(metadata.rootId);
    } else {
      this._root = new DataPage(await this._idGenerator(), true, [], []);
      await this.storeDataPage(this._root);
      this._metadata = new MetaPage(0, this._root.id);
      await this.storeMetadata();
    }
    this._setupComplete = true;
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
      await page.setHash();
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

  private async loadDataPage(id: number): Promise<DataPage<K, V>> {
    const result = await this._storage.get(id);
    if (result === undefined) {
      throw new Error('Page not in storage');
    }

    const page = await Page.deserializePage(result);

    if (page.refType === PageType.Data) {
      return DataPage.deserializeDataPage(page.refId, page.data);
    }

    throw new Error('Attempting to load data page with incorrect page type');
  }

  private async loadMetadata(): Promise<MetaPage | undefined> {
    const result = await this._storage.getMetadata();
    if (result === undefined) {
      return result;
    }

    const page = await Page.deserializePage(result);

    if (page.refType === PageType.Meta) {
      return MetaPage.deserializeMetaPage(page.refId, page.data);
    }

    throw new Error('Attempting to load meta page with incorrect page type');
  }

  private async findLeaf(
    key: K,
    path: PathElement<K, V>[],
    page: DataPage<K, V>,
  ): Promise<{ path: PathElement<K, V>[]; leaf: DataPage<K, V> }> {
    if (page.isLeaf) {
      return { path, leaf: page };
    } else {
      const { index, found } = page.getChildIndex(key);

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

    const newPageId = await this._idGenerator();
    let newRootId;
    if (path.length <= 0) {
      newRootId = await this._idGenerator();
    }

    const newPage: DataPage<K, V> = new DataPage(
      newPageId,
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
      const newPageChild = await this.loadDataPage(newPageChildId.pageId);
      page.pointers.push({ key: null, pageId: newPageChild.id });
    }

    await this.storeDataPage(newPage, path);
    await this.storeDataPage(page, path);

    if (path.length > 0) {
      const parent = path[path.length - 1].page;
      const { index } = parent.getChildIndex(midKey);
      parent.pointers.splice(index, 0, { key: midKey, pageId: page.id });
      parent.pointers[index + 1].pageId = newPage.id;

      const newPath = [...path].slice(0, path.length - 1);
      await this.storeDataPage(parent, newPath);
    } else {
      if (newRootId === undefined) {
        throw new Error('ID should be defined');
      }
      this._root = new DataPage(
        newRootId,
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
}

export default BPlusTree;
