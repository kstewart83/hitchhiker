import { Node, Child, IReferenceStorage, Metadata } from './Interfaces';
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
      this._root = { id: this._storage.newId(), isLeaf: true, children: [], childrenId: [] };
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
      return leaf.children[index].value;
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
      leaf.children[index].value = value;
      this._storage.put(leaf.id, leaf);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    const newChild = { id: this._storage.newId(), key, value };
    leaf.children.splice(index, 0, newChild);
    leaf.childrenId.splice(index, 0, newChild.id);
    this._storage.put(newChild.id, newChild);

    // if adding a new item fills the node, split it
    if (leaf.childrenId.length > this._branching - 1) {
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
      const child = this._storage.get(childId);
      if (child.nodeId !== undefined) {
        const childNode = this._storage.get(child.nodeId);
        return this.findLeaf(key, path.concat(node), childNode);
      }

      throw new Error('Child has undefined child');
    }
  }

  private toDOTInternal(node: Node<K, V>, str: string): string {
    if (node.isLeaf) {
      node.children.forEach((c) => {
        str += `n${node.id} [fillcolor="#ffddff", style=filled, label="N${node.id}"]\n`;
        str += `n${node.id} -> n${c.id}\n`;
        str += `n${c.id} [color=blue, label="N${c.id}|[${c.key}, ${c.value}]"]\n`;
      });
      return str;
    } else {
      node.children.forEach((c) => {
        if (c.nodeId) {
          str += `n${node.id} [fillcolor="#dddddd", style=filled, label="N${node.id}"]\n`;
          str += `n${node.id} -> n${c.id}\n`;
          str += `n${c.id} [fillcolor="#ffffdd", style=filled, label="N${c.id}|${c.key}"]\n`;
          str += `n${c.id} -> n${c.nodeId}\n`;
          const childNode = this._storage.get(c.id);
          str = this.toDOTInternal(childNode, str);
        }
      });

      return str;
    }
  }

  private getChildIndex(key: K, node: Node<K, V>): { index: number; found: boolean } {
    if (node.childrenId.length === 0) {
      return { index: 0, found: false };
    }

    let end = node.childrenId.length - 1;

    if (!node.isLeaf) {
      end--;
    }

    const index = this.getChildIndexBinarySearch(key, node.children, 0, end);
    const comparison = this.compareKey(key, node.children[index].key);

    if (comparison === 0) {
      return { index, found: true };
    } else if (comparison < 0) {
      return { index, found: false };
    } else {
      return { index: index + 1, found: false };
    }
  }

  private getChildIndexBinarySearch(key: K, children: Child<K, V>[], start: number, end: number): number {
    if (start === end) {
      return start;
    }

    const mid = Math.floor((start + end) / 2);
    const comparison = this.compareKey(key, children[mid].key);

    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      return this.getChildIndexBinarySearch(key, children, start, Math.max(start, mid - 1));
    } else {
      return this.getChildIndexBinarySearch(key, children, Math.min(end, mid + 1), end);
    }
  }

  private split(path: Node<K, V>[], node: Node<K, V>) {
    const midIndex = Math.floor((node.childrenId.length - (node.isLeaf ? 0 : 1)) / 2);
    const midKey = node.children[midIndex].key;
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
      children: node.children.slice(midIndex),
      childrenId: node.childrenId.slice(midIndex),
    };

    node.children = node.children.slice(0, midIndex);
    node.childrenId = node.childrenId.slice(0, midIndex);

    if (!node.isLeaf) {
      const newNodeChild = newNode.children.shift();
      newNode.childrenId.shift();
      if (newNodeChild && newNodeChild.nodeId) {
        const middleNode = this._storage.get(newNodeChild.nodeId);

        const newChild = { id: this._storage.newId(), key: null, node: middleNode, nodeId: middleNode.id };
        node.children.push(newChild);
        node.childrenId.push(newChild.id);
        this._storage.put(node.id, node);
        this._storage.put(newChild.id, newChild);
      }
      this._storage.put(newNode.id, newNode);
    }

    if (parent) {
      const { index } = this.getChildIndex(midKey, parent);

      const newChild = { id: this._storage.newId(), key: midKey, node, nodeId: node.id };
      parent.children.splice(index, 0, newChild);
      parent.childrenId.splice(index, 0, newChild.id);
      parent.children[index + 1].nodeId = newNode.id;

      this._storage.put(parent.id, parent);
      this._storage.put(newChild.id, newChild);
      this._storage.put(newNode.id, newNode);

      if (parent.childrenId.length > this._branching) {
        const newPath = [...path].slice(0, path.length - 1);
        this.split(newPath, parent);
      }
    } else {
      const newLeft = { id: this._storage.newId(), key: midKey, node, nodeId: node.id };
      const newRight = { id: this._storage.newId(), key: null, node: newNode, nodeId: newNode.id };
      this._root = {
        id: this._storage.newId(),
        isLeaf: false,
        children: [newLeft, newRight],
        childrenId: [newLeft.id, newRight.id],
      };
      this._storage.put(newNode.id, newNode);
      this._storage.put(newLeft.id, newLeft);
      this._storage.put(newRight.id, newRight);
      this._storage.put(this._root.id, this._root);
      this._storage.putMetadata({
        rootId: this._root.id,
      });
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
