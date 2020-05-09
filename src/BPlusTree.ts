import { Node, IReferenceStorage, Entry, Pointer, Metadata } from './Interfaces';
import MemoryStorage from './MemoryStorage';
import * as assert from 'assert';
import * as cbor from 'cbor';

export default class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each node.
   * @param comparator Custom compartor for key values
   */
  public constructor(branching: number, storage?: IReferenceStorage, comparator?: (a: K, b: K) => number) {
    this._branching = branching;
    if (storage) {
      this._storage = storage;
    } else {
      this._storage = new MemoryStorage();
    }
    this._comparator = comparator;
    this._metadata = this.getMetadata();
    if (this._metadata) {
      const root = this.getNode(this._metadata.rootId);
      this._root = root;
    } else {
      this._root = { id: this._storage.newId(), isLeaf: true, pointers: [], entries: [] };
      this.storeNode(this._root);
      this._metadata = {
        rootId: this._root.id,
      };
      this.storeMetadata();
    }
  }

  /**
   * This function searches the tree for the value associated with the search key.
   *
   * @param key Key to search for in tree
   * @returns Value associated with search key if it exists (can be null) or undefined
   * if search key is not in tree
   */
  public find(key: K): V | null | undefined {
    const { leaf } = this.findLeaf(key, [], this._root);
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
  public add(key: K, value?: V) {
    const { path, leaf } = this.findLeaf(key, [], this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    // if key already exists, overwrite existing value
    if (found) {
      leaf.entries[index].value = value;
      this.storeNode(leaf);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    leaf.entries.splice(index, 0, { key, value });
    this.storeNode(leaf);
    // this._storage.put(leaf.id, leaf);

    // if adding a new item fills the node, split it
    if (leaf.entries.length > this._branching - 1) {
      this.split(path, leaf);
    }
  }

  /**
   * Convert tree to DOT representation
   */
  public toDOT(): string {
    return this.toDOTInternal(this._root, '');
  }

  /*** PRIVATE ***/

  private _root: Node<K, V>;
  private _branching: number;
  private _comparator?: (a: K, b: K) => number;
  private _storage: IReferenceStorage;
  private _metadata: Metadata;

  private storeNode(node: Node<K, V>) {
    this._storage.put(node.id, this.serializeNode(node));
  }

  private getNode(id: number): Node<K, V> {
    const result = this._storage.get(id);
    if (result === undefined) {
      throw new Error('Node not in storage');
    }

    return this.deserializeNode(result);
  }

  private storeMetadata() {
    this._storage.putMetadata(this._metadata);
  }

  private getMetadata(): Metadata {
    this._metadata = this._storage.getMetadata();
    return this._metadata;
  }

  private serializeNode(node: Node<K, V>): Buffer {
    let data;
    if (node.isLeaf) {
      data = node.entries.map((x) => {
        return [x.key, x.value];
      });
    } else {
      data = node.pointers.map((x) => {
        return [x.key, x.nodeId];
      });
    }

    return cbor.encode(node.id, node.isLeaf, data);
  }

  private deserializeNode(cborData: Buffer): Node<K, V> {
    const decodeArray = cbor.decodeAllSync(cborData);
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

  private findLeaf(key: K, path: Node<K, V>[], node: Node<K, V>): { path: Node<K, V>[]; leaf: Node<K, V> } {
    if (node.isLeaf) {
      return { path, leaf: node };
    } else {
      const { index, found } = this.getChildIndex(key, node);

      const childId = node.pointers[index + (found ? 1 : 0)];
      const child = this.getNode(childId.nodeId);
      return this.findLeaf(key, path.concat(node), child);
    }
  }

  private toDOTInternal(node: any, str: string): string {
    if (node.pointers === undefined && node.nodeId === undefined) {
      str += `n${node.id} [color=blue, label="<n>C${node.id}|[${node.key},${node.value}]"]\n`;
      return str;
    }

    if (node.nodeId !== undefined) {
      str += `n${node.id} [fillcolor="#dddddd", style=filled, label="<n>C${node.id}"]\n`;
      str += `n${node.id} -> n${node.nodeId}\n`;
      const next = this._storage.get(node.nodeId);
      str = this.toDOTInternal(next, str);
    }

    if (node.pointers !== undefined) {
      let fieldStr = '';
      let i = 0;
      if (node.isLeaf) {
        node.entries.forEach((d: Entry<K, V>) => {
          fieldStr += `|<c${i++}>[${d.key},${d.value == null ? '*' : d.value}]`;
        });
        node.pointers.forEach((cId: Pointer<K>) => {
          const child = this.getNode(cId.nodeId);
          str += `n${node.id}:c${i} -> n${cId.nodeId}\n`;
          str = this.toDOTInternal(child, str);
        });
      } else {
        node.pointers.forEach((cId: Pointer<K>) => {
          const child = this.getNode(cId.nodeId);
          str += `n${node.id}:c${i} -> n${cId.nodeId}\n`;
          fieldStr += `|<c${i++}>${cId.key == null ? '*' : cId.key}`;
          str = this.toDOTInternal(child, str);
        });
      }

      str += `n${node.id} [fillcolor="${node.isLeaf ? '#ffddff' : '#ffffdd'}", style=filled, label="<n>N${
        node.id
      }${fieldStr}"]\n`;
    }

    return str;
  }

  private getChildIndex(key: K, node: Node<K, V>): { index: number; found: boolean } {
    let comparison: number;
    let index: number;
    if (node.isLeaf) {
      if (node.entries.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, node, 0, node.entries.length - 1);
      comparison = this.compareKey(key, node.entries[index].key);
    } else {
      if (node.pointers.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, node, 0, node.pointers.length - 2);
      const otherKey = node.pointers[index].key;
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

  private getChildIndexBinarySearch(key: K, node: Node<K, V>, start: number, end: number): number {
    if (start === end) {
      return start;
    }

    const mid = Math.floor((start + end) / 2);
    let otherKey;
    if (node.isLeaf) {
      otherKey = node.entries[mid].key;
    } else {
      otherKey = node.pointers[mid].key;
    }
    const comparison = this.compareKey(key, otherKey);

    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      return this.getChildIndexBinarySearch(key, node, start, Math.max(start, mid - 1));
    } else {
      return this.getChildIndexBinarySearch(key, node, Math.min(end, mid + 1), end);
    }
  }

  private split(path: Node<K, V>[], node: Node<K, V>) {
    let midKey: K | null;
    let midIndex: number;
    if (node.isLeaf) {
      midIndex = Math.floor((node.entries.length - (node.isLeaf ? 0 : 1)) / 2);
      midKey = node.entries[midIndex].key;
    } else {
      midIndex = Math.floor((node.pointers.length - (node.isLeaf ? 0 : 1)) / 2);
      midKey = node.pointers[midIndex].key;
    }

    let pathParent: Node<K, V> | null = path[path.length - 1];
    if (pathParent === undefined) {
      pathParent = null;
    }
    const parent = pathParent;

    if (midKey == null) {
      throw new Error('Key is null');
    }

    const newNode: Node<K, V> = {
      id: this._storage.newId(),
      isLeaf: node.isLeaf,
      pointers: node.pointers.slice(midIndex),
      entries: node.entries.slice(midIndex),
    };

    node.pointers = node.pointers.slice(0, midIndex);
    node.entries = node.entries.slice(0, midIndex);

    if (!node.isLeaf) {
      const newNodeChildId = newNode.pointers.shift();
      if (newNodeChildId === undefined) {
        throw new Error('Trying to split empty internal node');
      }
      const newNodeChild = this.getNode(newNodeChildId.nodeId);
      node.pointers.push({ key: null, nodeId: newNodeChild.id });
    }

    this.storeNode(newNode);
    this.storeNode(node);

    if (parent) {
      const { index } = this.getChildIndex(midKey, parent);
      parent.pointers.splice(index, 0, { key: midKey, nodeId: node.id });
      parent.pointers[index + 1].nodeId = newNode.id;

      this.storeNode(parent);
      if (parent.pointers.length > this._branching) {
        const newPath = [...path].slice(0, path.length - 1);
        this.split(newPath, parent);
      }
    } else {
      this._root = {
        id: this._storage.newId(),
        isLeaf: false,
        pointers: [
          { key: midKey, nodeId: node.id },
          { key: null, nodeId: newNode.id },
        ],
        entries: [],
      };

      this.storeNode(this._root);
      this._metadata = {
        rootId: this._root.id,
      };
      this.storeMetadata();
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
