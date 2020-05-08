import { Node, Child, IReferenceStorage, Metadata, Pointer, Datum } from './Interfaces';
import MemoryStorage from './MemoryStorage';

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
    this._metadata = this._storage.getMetadata();
    if (this._metadata) {
      this._root = this._storage.get(this._metadata.rootId);
    } else {
      this._root = { id: this._storage.newId(), isLeaf: true, childrenId: [], data: [] };
      this._storage.put(this._root.id, this._root);
      this._metadata = {
        rootId: this._root.id,
      };
      this._storage.putMetadata(this._metadata);
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
      return leaf.data[index].value;
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
      leaf.data[index].value = value;
      this._storage.put(leaf.id, leaf);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    const newChild = { id: this._storage.newId(), key, value };
    leaf.data.splice(index, 0, { key: newChild.key, value: newChild.value });
    this._storage.put(leaf.id, leaf);

    // if adding a new item fills the node, split it
    if (leaf.data.length > this._branching - 1) {
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

  private findLeaf(key: K, path: Node<K, V>[], node: Node<K, V>): { path: Node<K, V>[]; leaf: Node<K, V> } {
    if (node.isLeaf) {
      return { path, leaf: node };
    } else {
      const { index, found } = this.getChildIndex(key, node);

      const childId = node.childrenId[index + (found ? 1 : 0)];
      const child = this._storage.get(childId.nodeId);
      if (child.nodeId !== undefined) {
        const childNode = this._storage.get(child.nodeId);
        return this.findLeaf(key, path.concat(node), childNode);
      }

      throw new Error('Child has undefined child');
    }
  }

  private toDOTInternal(node: any, str: string): string {
    if (node.childrenId === undefined && node.nodeId === undefined) {
      str += `n${node.id} [color=blue, label="<n>C${node.id}|[${node.key},${node.value}]"]\n`;
      return str;
    }

    if (node.nodeId !== undefined) {
      str += `n${node.id} [fillcolor="#dddddd", style=filled, label="<n>C${node.id}"]\n`;
      str += `n${node.id} -> n${node.nodeId}\n`;
      const next = this._storage.get(node.nodeId);
      str = this.toDOTInternal(next, str);
    }

    if (node.childrenId !== undefined) {
      let fieldStr = '';
      let i = 0;
      if (node.isLeaf) {
        node.data.forEach((d: any) => {
          fieldStr += `|<c${i++}>[${d.key},${d.value == null ? '*' : d.value}]`;
        });
        node.childrenId.forEach((cId: any) => {
          const child = this._storage.get(cId.nodeId);
          if (child.nodeId) {
            str += `n${node.id}:c${i} -> n${child.nodeId} [style=dotted]\n`;
          }
          str += `n${node.id}:c${i} -> n${cId.nodeId}\n`;
          str = this.toDOTInternal(child, str);
        });
      } else {
        node.childrenId.forEach((cId: any) => {
          const child = this._storage.get(cId.nodeId);
          if (child.nodeId) {
            str += `n${node.id}:c${i} -> n${child.nodeId} [style=dotted]\n`;
          }
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
      if (node.data.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, node, 0, node.data.length - 1);
      comparison = this.compareKey(key, node.data[index].key);
    } else {
      if (node.childrenId.length === 0) {
        return { index: 0, found: false };
      }

      index = this.getChildIndexBinarySearch(key, node, 0, node.childrenId.length - 2);
      const nodeChild = this._storage.get(node.childrenId[index].nodeId);
      comparison = this.compareKey(key, nodeChild.key);
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
      otherKey = node.data[mid].key;
    } else {
      otherKey = this._storage.get(node.childrenId[mid].nodeId).key;
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
    let midKey: K;
    let midIndex: number;
    if (node.isLeaf) {
      midIndex = Math.floor((node.data.length - (node.isLeaf ? 0 : 1)) / 2);
      midKey = node.data[midIndex].key;
    } else {
      midIndex = Math.floor((node.childrenId.length - (node.isLeaf ? 0 : 1)) / 2);
      const midChild = this._storage.get(node.childrenId[midIndex].nodeId);
      midKey = midChild.key;
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
      childrenId: node.childrenId.slice(midIndex),
      data: node.data.slice(midIndex),
    };

    node.childrenId = node.childrenId.slice(0, midIndex);
    node.data = node.data.slice(0, midIndex);

    if (!node.isLeaf) {
      const newNodeChildId = newNode.childrenId.shift();
      if (newNodeChildId === undefined) {
        throw new Error('Trying to split empty leaf');
      }
      const newNodeChild = this._storage.get(newNodeChildId.nodeId);
      if (newNodeChild && newNodeChild.nodeId) {
        const middleNode = this._storage.get(newNodeChild.nodeId);

        const newChild = { id: this._storage.newId(), key: null, nodeId: middleNode.id };
        node.childrenId.push({ key: newChild.key, nodeId: newChild.id });
        this._storage.put(node.id, node);
        this._storage.put(newChild.id, newChild);
      }
      this._storage.put(newNode.id, newNode);
    }

    if (parent) {
      const { index } = this.getChildIndex(midKey, parent);

      const newChild = { id: this._storage.newId(), key: midKey, nodeId: node.id };
      parent.childrenId.splice(index, 0, { key: newChild.key, nodeId: newChild.id });

      const other = this._storage.get(parent.childrenId[index + 1].nodeId) as Child<K, V>;
      other.nodeId = newNode.id;

      this._storage.put(parent.id, parent);
      this._storage.put(newChild.id, newChild);
      this._storage.put(newNode.id, newNode);

      if (parent.childrenId.length > this._branching) {
        const newPath = [...path].slice(0, path.length - 1);
        this.split(newPath, parent);
      }
    } else {
      const newLeft = { id: this._storage.newId(), key: midKey, nodeId: node.id };
      const newRight = { id: this._storage.newId(), key: null, nodeId: newNode.id };
      this._root = {
        id: this._storage.newId(),
        isLeaf: false,
        childrenId: [
          { key: newLeft.key, nodeId: newLeft.id },
          { key: newRight.key, nodeId: newRight.id },
        ],
        data: [],
      };
      this._storage.put(newNode.id, newNode);
      this._storage.put(newLeft.id, newLeft);
      this._storage.put(newRight.id, newRight);
      this._storage.put(this._root.id, this._root);
      this._metadata = {
        rootId: this._root.id,
      };
      this._storage.putMetadata(this._metadata);
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
