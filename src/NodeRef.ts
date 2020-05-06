import { INode, IChild, INodeRef, IChildRef, IReference } from './Interfaces';
import ChildRef from './ChildRef';

export default class NodeRef<K, V> implements INodeRef<K, V>, IReference<NodeRef<K, V>> {
  public constructor(id: number, node: INode<K, V>) {
    this._id = id;
    this._node = node;
  }

  public id() {
    return this._id;
  }

  serialize() {
    return new Buffer('');
  }

  deserialize(buffer: Buffer) {
    return new NodeRef<K, V>(0, { isLeaf: false, parent: null, children: [] });
  }

  isLeaf() {
    return this._node.isLeaf;
  }

  parent() {
    return this._node.parent;
  }

  getChild(index: number) {
    return this._node.children[index];
  }

  putChild(index: number, child: IChildRef<K, V>) {
    if (child instanceof ChildRef) {
      const key = child.key();
      const value = child.value();
      const node = child.node();
      const childRef = new ChildRef(child._id, { key, value, node });
      this._node.children.splice(index, 0, childRef);
      return null;
    } else {
      throw new Error('Argument not instance of ChildRef');
    }
  }

  _id: number;
  _node: INode<K, V>;
}
