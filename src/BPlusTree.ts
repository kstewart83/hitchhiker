import { DataNode, IReferenceStorage, Node, NodeType, MetaNode, PathElement } from './Interfaces';
import MemoryStorage from './MemoryStorage';
import * as cbor from 'cbor';
import { ServerlessApplicationRepository } from 'aws-sdk';

export class BPlusTree<K, V> {
  /*** PUBLIC ***/

  /**
   * @param branching Branching factor for each node.
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
    this._maxNodeSize = this._storage.maxNodeSize();
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
      await this.storeDataNode(leaf, path);
      return;
    }

    // otherwise, insert key/value pair based on the returned index
    leaf.entries.splice(index, 0, { key, value });
    await this.storeDataNode(leaf, path);
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
    const { index, found } = await this.getChildIndex(key, leaf);

    // if key exists, remove entry
    if (found) {
      const entry = leaf.entries.splice(index, 1)[0];
      await this.storeDataNode(leaf, path);
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
      const node = await this.deserializeNode(nextResult.buffer);

      if (node.type === NodeType.Data) {
        str += await this.dataNodeToDOT(node as DataNode<K, V>, next.value.key);
      } else if (node.type === NodeType.Meta) {
        str += await this.metaNodeToDOT(node as MetaNode, next.value.key);
      } else {
        throw new Error('Unknown Node Type');
      }

      next = gen.next();
    }

    return str;
  }

  /*** PRIVATE ***/

  private _setupComplete: boolean;
  private _root: DataNode<K, V> | undefined;
  private _comparator?: (a: K, b: K) => number;
  private _storage: IReferenceStorage;
  private _metadata: MetaNode | undefined;
  private _idGenerator: () => number;
  private readonly _fillFactor: number;
  private readonly _maxNodeSize: number;

  private async blockOnSetup() {
    while (!this._setupComplete) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  private async setup() {
    const metadata = await this.loadMetadata();
    if (metadata) {
      this._metadata = metadata;
      this._root = await this.loadDataNode(metadata.rootId);
    } else {
      this._root = { id: this._idGenerator(), type: NodeType.Data, isLeaf: true, pointers: [], entries: [] };
      await this.storeDataNode(this._root);
      this._metadata = {
        id: 0,
        type: NodeType.Meta,
        rootId: this._root.id,
      };
      await this.storeMetadata();
    }
    this._setupComplete = true;
  }

  private async metaNodeToDOT(node: MetaNode, internalId: number): Promise<string> {
    let str = `tree -> n${internalId}\n`;
    if (this._storage instanceof MemoryStorage) {
      const memStor = this._storage as MemoryStorage;
      if (internalId === memStor.DataMetadataId) {
        str += `n${internalId} [label="Data"]\n`;
      } else if (internalId === memStor.IdMapMetadataId) {
        str += `n${internalId} [label="ID Map"]\n`;
      } else {
        str += `n${internalId} [label="M${node.id}:I${internalId}"]\n`;
      }
    } else {
      str += `n${internalId} [label="M${node.id}:I${internalId}"]\n`;
    }
    str += `n${internalId} -> n${node.rootId}\n`;
    return str;
  }

  private async dataNodeToDOT(node: DataNode<K, V>, internalId: number) {
    let str = '';
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
    <tr><td cellborder="1" bgcolor="#eeffff"><b>E${node.id}:I${internalId}</b></td></tr>
    <hr/>
    <tr><td border="0" >
      <table cellspacing='0'>
        <tr><td bgcolor="#88ffcc"><b>K</b></td><td bgcolor="#88ffcc"><b>V</b></td></tr>        `;
      node.entries.forEach((d) => {
        fieldStr += `        <tr><td>${d.key}</td><td>${d.value == null ? '*' : d.value}`;
        fieldStr += `</td></tr>\n`;
      });
      fieldStr += `
      </table>
    </td></tr>
  </table>`;
      str += `n${node.id} [${fillColor}, style=filled, label=<${fieldStr}>];\n`;
    } else {
      node.pointers.forEach((cId) => {
        str += `n${node.id}:c${i} -> n${cId.nodeId}\n`;
        fieldStr += `|<c${i++}>${cId.key == null ? '*' : cId.key}`;
      });
      str += `n${node.id} [${fillColor}, style=filled, label="E${node.id}:I${internalId}${fieldStr}"]\n`;
    }
    return str;
  }

  private async storeMetadata() {
    if (this._metadata === undefined) {
      throw new Error('Root is not defined');
    }
    const nodeBuf = await this.serializeNode(this._metadata);
    await this._storage.putMetadata(nodeBuf);
  }

  private async storeDataNode(node: DataNode<K, V>, path?: PathElement<K, V>[]) {
    if (this._root === undefined) {
      throw new Error('Root is not defined');
    }
    const nodeBuf = await this.serializeNode(node);

    // if adding a new item fills the node, split it
    if (nodeBuf.length > this._maxNodeSize) {
      // overflow, need to split
      if (path === undefined) {
        throw new Error('Must provide path if node exceeds max size');
      }
      await this.split(node, path);
    } else if (this._root.id === node.id && this._root.pointers.length === 1) {
      // root is down to one child, need to consolidate into new root as leaf
      const oldRootId = this._root.id;
      const onlyChild = await this.loadDataNode(node.pointers[0].nodeId);
      this._root = onlyChild;
      this._metadata = {
        id: 0,
        type: NodeType.Meta,
        rootId: onlyChild.id,
      };
      await this.storeMetadata();
      await this._storage.free(oldRootId);
    } else if (this._root.id !== node.id && nodeBuf.length < this._maxNodeSize / this._fillFactor) {
      // a node as underflowed, need to borrow/merge with siblings
      if (path === undefined) {
        throw new Error('Must provide path if node is less than minimum size');
      }
      await this.underflow(node, path);
    } else {
      await this._storage.put(node.id, nodeBuf);
    }
  }

  private async underflow(node: DataNode<K, V>, path: PathElement<K, V>[]) {
    const parentElement = path[path.length - 1];
    const upperSiblingId = parentElement.node.pointers[parentElement.index + 1];
    const lowerSiblingId = parentElement.node.pointers[parentElement.index - 1];
    let upper: DataNode<K, V>;
    let lower: DataNode<K, V>;
    if (upperSiblingId) {
      const upperSibling = await this.loadDataNode(upperSiblingId.nodeId);
      lower = node;
      upper = upperSibling;
    } else if (lowerSiblingId) {
      const lowerSibling = await this.loadDataNode(lowerSiblingId.nodeId);
      lower = lowerSibling;
      upper = node;
    } else {
      throw new Error('Underflow nodes should have at least one sibling');
    }

    let lowerSerialization = await this.serializeNode(lower);
    let upperSerialization = await this.serializeNode(upper);

    const fillRatio = this._maxNodeSize / this._fillFactor;
    let onlyOneChild = false;

    if (lowerSerialization.length < fillRatio) {
      // need to flow elements high to low
      while (lowerSerialization.length < fillRatio && upperSerialization.length >= fillRatio) {
        if (node.isLeaf) {
          const next = upper.entries.shift();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          lower.entries.push(next);
          const parentEntry = upper.entries[0];
          if (parentEntry === undefined) {
            lowerSerialization = await this.serializeNode(lower);
            upperSerialization = await this.serializeNode(upper);
            break;
          }
          parentElement.node.pointers[parentElement.index].key = parentEntry.key;
        } else {
          const next = upper.pointers.shift();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          lower.pointers[lower.pointers.length - 1].key = parentElement.node.pointers[parentElement.index].key;
          parentElement.node.pointers[parentElement.index].key = next.key;
          next.key = null;
          lower.pointers.push(next);
          onlyOneChild = upper.pointers.length <= 1;
        }

        lowerSerialization = await this.serializeNode(lower);
        upperSerialization = await this.serializeNode(upper);
      }

      if (upperSerialization.length < fillRatio || onlyOneChild) {
        this.merge(node, lower, upper, path);
      }
    } else if (upperSerialization.length < fillRatio) {
      // need to flow elements low to high
      while (upperSerialization.length < fillRatio && lowerSerialization.length >= fillRatio) {
        if (node.isLeaf) {
          const next = lower.entries.pop();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }
          upper.entries.unshift(next);
          const parentKey = upper.entries[0].key;
          if (node.id === upper.id) {
            parentElement.node.pointers[parentElement.index - 1].key = parentKey;
          } else {
            parentElement.node.pointers[parentElement.index].key = parentKey;
          }
        } else {
          const next = lower.pointers.pop();
          if (next === undefined) {
            throw new Error('Upper sibling must have elements in underflow high to low');
          }

          let parentIndex: number;
          if (node.id === upper.id) {
            parentIndex = parentElement.index - 1;
          } else {
            parentIndex = parentElement.index;
          }
          next.key = parentElement.node.pointers[parentIndex].key;
          parentElement.node.pointers[parentIndex].key = lower.pointers[lower.pointers.length - 1].key;
          if (lower.pointers.length > 1) {
            lower.pointers[lower.pointers.length - 1].key = null;
          } else {
            onlyOneChild = true;
          }
          upper.pointers.unshift(next);
        }

        lowerSerialization = await this.serializeNode(lower);
        upperSerialization = await this.serializeNode(upper);
      }

      if (lowerSerialization.length < fillRatio || onlyOneChild) {
        this.merge(node, lower, upper, path);
      }
    } else {
      throw new Error('Siblings should not be of equal length');
    }

    const parentPath = [...path];
    parentPath.pop();

    if (lower.entries.length === 0 && lower.pointers.length === 0) {
      await this._storage.free(lower.id);
    } else {
      await this.storeDataNode(lower);
    }

    if (upper.entries.length === 0 && upper.pointers.length === 0) {
      await this._storage.free(upper.id);
    } else {
      await this.storeDataNode(upper);
    }
    await this.storeDataNode(parentElement.node, parentPath);
  }

  private merge(node: DataNode<K, V>, lower: DataNode<K, V>, upper: DataNode<K, V>, path: PathElement<K, V>[]) {
    const parentElement = path[path.length - 1];
    let parentIndex: number;

    if (node.id === upper.id) {
      parentIndex = parentElement.index - 1;
    } else {
      parentIndex = parentElement.index;
    }

    if (node.isLeaf) {
      upper.entries.unshift(...lower.entries);
      lower.entries = [];
    } else {
      lower.pointers[lower.pointers.length - 1].key = parentElement.node.pointers[parentIndex].key;
      upper.pointers.unshift(...lower.pointers);
      lower.pointers = [];
    }

    parentElement.node.pointers.splice(parentIndex, 1);
  }

  private async loadNode(id: number): Promise<Node> {
    const result = await this._storage.get(id);
    if (result === undefined) {
      throw new Error('Node not in storage');
    }

    return await this.deserializeNode(result);
  }

  private async loadDataNode(id: number): Promise<DataNode<K, V>> {
    const result = await this._storage.get(id);
    if (result === undefined) {
      throw new Error('Node not in storage');
    }

    const node = await this.deserializeNode(result);

    if (node.type === NodeType.Data) {
      return node as DataNode<K, V>;
    }

    throw new Error('Node ID not associated with metanode');
  }

  private async loadMetadata(): Promise<MetaNode | undefined> {
    const result = await this._storage.getMetadata();
    if (result === undefined) {
      return result;
    }
    this._metadata = cbor.decode(result) as MetaNode;
    return this._metadata;
  }

  private async serializeNode(node: DataNode<K, V> | MetaNode): Promise<Buffer> {
    let data: any;
    if (node.type === NodeType.Data) {
      const d = node as DataNode<K, V>;
      if (d.isLeaf) {
        data = d.entries.map((x) => {
          return [x.key, x.value];
        });
      } else {
        data = d.pointers.map((x) => {
          return [x.key, x.nodeId];
        });
      }
      data.unshift(d.isLeaf);
    } else if (node.type === NodeType.Meta) {
      const m = node as MetaNode;
      data = m.rootId;
    } else {
      throw new Error('Unknown node type');
    }

    return cbor.encode(node.id, node.type, data);
  }

  private async deserializeNode(cborData: Buffer): Promise<Node> {
    const decodeArray = await cbor.decodeAll(cborData);
    const refId = decodeArray[0] as number;
    const refType = decodeArray[1] as number;
    const data = decodeArray[2] as any;

    if (refType === NodeType.Data) {
      let ref: DataNode<K, V>;
      const isLeaf = data.shift();
      if (isLeaf) {
        ref = {
          id: refId,
          type: NodeType.Data,
          isLeaf,
          pointers: [],
          entries: data.map((x: any[]) => {
            return { key: x[0] as K, value: x[1] as V };
          }),
        };

        return ref;
      } else {
        ref = {
          id: refId,
          type: NodeType.Data,
          isLeaf,
          pointers: data.map((x: any[]) => {
            return { key: x[0] as K, nodeId: x[1] as number };
          }),
          entries: [],
        };
      }
      return ref;
    } else if (refType === NodeType.Meta) {
      let ref: MetaNode;
      ref = {
        id: refId,
        type: NodeType.Meta,
        rootId: data,
      };
      return ref;
    } else {
      throw new Error('Unknown node type');
    }
  }

  private async findLeaf(
    key: K,
    path: PathElement<K, V>[],
    node: DataNode<K, V>,
  ): Promise<{ path: PathElement<K, V>[]; leaf: DataNode<K, V> }> {
    if (node.isLeaf) {
      return { path, leaf: node };
    } else {
      const { index, found } = this.getChildIndex(key, node);

      const childId = node.pointers[index + (found ? 1 : 0)];
      const child = await this.loadDataNode(childId.nodeId);
      return await this.findLeaf(
        key,
        path.concat({
          node,
          index: index + (found ? 1 : 0),
          found,
        }),
        child,
      );
    }
  }

  private getChildIndex(key: K, node: DataNode<K, V>): { index: number; found: boolean } {
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

  private getChildIndexBinarySearch(key: K, node: DataNode<K, V>, start: number, end: number): number {
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

  private async split(node: DataNode<K, V>, path: PathElement<K, V>[]) {
    let midKey: K | null;
    let midIndex: number;
    if (node.isLeaf) {
      midIndex = Math.floor((node.entries.length - (node.isLeaf ? 0 : 1)) / 2);
      midKey = node.entries[midIndex].key;
    } else {
      midIndex = Math.floor((node.pointers.length - (node.isLeaf ? 0 : 1)) / 2);
      midKey = node.pointers[midIndex].key;
    }

    if (midKey == null) {
      throw new Error('Key is null');
    }

    const newNode: DataNode<K, V> = {
      id: this._idGenerator(),
      type: NodeType.Data,
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
      const newNodeChild = await this.loadNode(newNodeChildId.nodeId);
      node.pointers.push({ key: null, nodeId: newNodeChild.id });
    }

    await this.storeDataNode(newNode, path);
    await this.storeDataNode(node, path);

    if (path.length > 0) {
      const parent = path[path.length - 1].node;
      const { index } = await this.getChildIndex(midKey, parent);
      parent.pointers.splice(index, 0, { key: midKey, nodeId: node.id });
      parent.pointers[index + 1].nodeId = newNode.id;

      const newPath = [...path].slice(0, path.length - 1);
      await this.storeDataNode(parent, newPath);
    } else {
      this._root = {
        id: this._idGenerator(),
        type: NodeType.Data,
        isLeaf: false,
        pointers: [
          { key: midKey, nodeId: node.id },
          { key: null, nodeId: newNode.id },
        ],
        entries: [],
      };

      await this.storeDataNode(this._root);
      this._metadata = {
        id: 0,
        type: NodeType.Meta,
        rootId: this._root.id,
      };
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
