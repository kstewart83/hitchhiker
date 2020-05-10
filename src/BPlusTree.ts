import { Node, IReferenceStorage, Entry, Pointer, Metadata } from './Interfaces';
import MemoryStorage from './MemoryStorage';
import * as cbor from 'cbor';

export class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each node.
   * @param comparator Custom compartor for key values
   */
  public constructor(storage?: IReferenceStorage, comparator?: (a: K, b: K) => number, idGenerator?: () => number) {
    if (storage) {
      this._storage = storage;
    } else {
      this._storage = new MemoryStorage();
    }
    if (idGenerator === undefined) {
      const baseId = 99000000;
      this._idGenerator = () => {
        return baseId + Math.floor(Math.random() * 10000000);
      };
    } else {
      this._idGenerator = idGenerator;
    }
    this._comparator = comparator;
    const metadata = this.loadMetadata();
    if (metadata) {
      this._metadata = metadata;
      this._root = this.loadNode(metadata.rootId);
    } else {
      this._root = { id: this._idGenerator(), isLeaf: true, pointers: [], entries: [] };
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
  public find(key: K): V | undefined {
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
      this.storeNode(leaf, path);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    leaf.entries.splice(index, 0, { key, value });
    this.storeNode(leaf, path);
  }

  /**
   * This function deletes the key/value pair from the tree
   *
   * @param key Key to delete from tree
   */
  public delete(key: K): V | undefined {
    const { path, leaf } = this.findLeaf(key, [], this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    // if key already exists, overwrite existing value
    if (found) {
      const entry = leaf.entries.splice(index, 1)[0];
      this.storeNode(leaf, path);
      return entry.value;
    } else {
      return undefined;
    }

    return;
  }

  /**
   * Convert tree to DOT representation
   */
  public toDOT(): string {
    let str = '';
    const gen = this._storage.generator();
    let next = gen.next();
    while (!next.done) {
      const nextResult = next.value;
      const node = this.deserializeNode(nextResult.buffer);
      let fieldStr = '';
      let i = 0;
      let fillColor = '';
      if (node.id > 9900000) {
        fillColor = `fillcolor="${node.isLeaf ? '#ddffff' : '#ffffdd'}"`;
      } else {
        fillColor = `fillcolor="${node.isLeaf ? '#88ffff' : '#ffff88'}"`;
      }
      if (node.isLeaf) {
        fieldStr += `
  <table border="0" cellborder="1" cellspacing="0">
    <tr><td cellborder="1" bgcolor="#eeffff"><b>E${node.id}:I${next.value.key}</b></td></tr>
    <hr/>
    <tr><td border="0" >
      <table cellspacing='0'>
        <tr><td bgcolor="#88ffcc"><b>K</b></td><td bgcolor="#88ffcc"><b>V</b></td></tr>        
        `;
        node.entries.forEach((d) => {
          fieldStr += `<tr><td>${d.key}</td><td>${d.value == null ? '*' : d.value}`;
          fieldStr += `</td></tr>\n`;
        });
        fieldStr += `
        </table></td></tr>
        </table>`;
        str += `n${node.id} [${fillColor}, style=filled, label=<${fieldStr}>];\n`;
      } else {
        node.pointers.forEach((cId) => {
          str += `n${node.id}:c${i} -> n${cId.nodeId}\n`;
          fieldStr += `|<c${i++}>${cId.key == null ? '*' : cId.key}`;
        });
        str += `n${node.id} [${fillColor}, style=filled, label="E${node.id}:I${next.value.key}${fieldStr}"]\n`;
      }
      next = gen.next();
    }

    return str;
  }

  /*** PRIVATE ***/

  private _root: Node<K, V>;
  private _comparator?: (a: K, b: K) => number;
  private _storage: IReferenceStorage;
  private _metadata: Metadata;
  private _idGenerator: () => number;

  private storeNode(node: Node<K, V>, path?: Node<K, V>[]) {
    const nodeBuf = this.serializeNode(node);

    // if adding a new item fills the node, split it
    if (nodeBuf.length > this._storage.maxNodeSize()) {
      if (path === undefined) {
        throw new Error('Must provide path if node exceeds max size');
      }
      this.split(path, node);
    } else {
      this._storage.put(node.id, nodeBuf);
    }
  }

  private loadNode(id: number): Node<K, V> {
    const result = this._storage.get(id);
    if (result === undefined) {
      throw new Error('Node not in storage');
    }

    return this.deserializeNode(result);
  }

  private storeMetadata() {
    this._storage.putMetadata(cbor.encode(this._metadata));
  }

  private loadMetadata(): Metadata | undefined {
    const result = this._storage.getMetadata();
    if (result === undefined) {
      return result;
    }
    this._metadata = cbor.decode(result) as Metadata;
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
      const child = this.loadNode(childId.nodeId);
      return this.findLeaf(key, path.concat(node), child);
    }
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
      id: this._idGenerator(),
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
      const newNodeChild = this.loadNode(newNodeChildId.nodeId);
      node.pointers.push({ key: null, nodeId: newNodeChild.id });
    }

    this.storeNode(newNode, path);
    this.storeNode(node, path);

    if (parent) {
      const { index } = this.getChildIndex(midKey, parent);
      parent.pointers.splice(index, 0, { key: midKey, nodeId: node.id });
      parent.pointers[index + 1].nodeId = newNode.id;

      const newPath = [...path].slice(0, path.length - 1);
      this.storeNode(parent, newPath);
    } else {
      this._root = {
        id: this._idGenerator(),
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

export default BPlusTree;
