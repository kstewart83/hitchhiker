import { Node, Child } from './Interfaces';

export default class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each node.
   * @param comparator Custom compartor for key values
   */
  public constructor(branching: number, comparator?: (a: K, b: K) => number) {
    this._branching = branching;
    this._comparator = comparator;
    this._root = { isLeaf: true, parent: null, children: [] };
  }

  /**
   * This function searches the tree for the value associated with the search key.
   *
   * @param key Key to search for in tree
   * @returns Value associated with search key if it exists (can be null) or undefined
   * if search key is not in tree
   */
  public find(key: K): V | null | undefined {
    const leaf = this.findLeaf(key, this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    if (found) {
      return leaf.children[index].value;
    } else {
      return null;
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
    const leaf = this.findLeaf(key, this._root);
    const { index, found } = this.getChildIndex(key, leaf);

    // if key already exists, overwrite existing value
    if (found) {
      leaf.children[index].value = value;
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    leaf.children.splice(index, 0, { key, value });

    // if adding a new item fills the node, split it
    if (leaf.children.length > this._branching - 1) {
      this.split(leaf);
    }
  }

  /*** PRIVATE ***/

  private _root: Node<K, V>;
  private _branching: number;
  private _comparator?: (a: K, b: K) => number;

  private findLeaf(key: K, node: Node<K, V>): Node<K, V> {
    if (node.isLeaf) {
      return node;
    } else {
      const { index, found } = this.getChildIndex(key, node);

      const child = node.children[index + (found ? 1 : 0)];
      if (child.node) {
        return this.findLeaf(key, child.node);
      }

      throw new Error('Child has undefined child');
    }
  }

  private getChildIndex(key: K, node: Node<K, V>): { index: number; found: boolean } {
    if (node.children.length === 0) {
      return { index: 0, found: false };
    }

    let end = node.children.length - 1;

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

  private split(node: Node<K, V>) {
    const midIndex = Math.floor((node.children.length - (node.isLeaf ? 0 : 1)) / 2);
    const midKey = node.children[midIndex].key;

    if (midKey == null) {
      throw new Error('Key is null');
    }

    const newNode: Node<K, V> = {
      isLeaf: node.isLeaf,
      parent: node.parent,
      children: node.children.slice(midIndex),
    };

    node.children = node.children.slice(0, midIndex);

    if (!node.isLeaf) {
      const newNodeChild = newNode.children.shift();
      if (newNodeChild && newNodeChild.node) {
        const middleNode = newNodeChild.node;

        node.children.push({ key: null, node: middleNode });

        for (const child of newNode.children) {
          if (child.node) {
            child.node.parent = newNode;
          }
        }
      }
    }

    const parent = node.parent;
    if (parent) {
      const { index } = this.getChildIndex(midKey, parent);

      parent.children.splice(index, 0, { key: midKey, node });
      parent.children[index + 1].node = newNode;

      if (parent.children.length > this._branching) {
        this.split(parent);
      }
    } else {
      this._root = {
        isLeaf: false,
        parent: null,
        children: [
          { key: midKey, node },
          { key: null, node: newNode },
        ],
      };

      node.parent = newNode.parent = this._root;
    }
  }

  private compareKey(a: K | null, b: K | null): number {
    if (a == null || b == null) {
      throw new Error('Key is null');
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
