import { INode, IChild, INodeRef, IChildRef, IReference } from './Interfaces';

export default class ChildRef<K, V> implements IChildRef<K, V>, IReference<ChildRef<K, V>> {
  public constructor(id: number, node: IChild<K, V>) {
    this._id = id;
    this._node = node;
  }

  id(): number {
    return this._id;
  }

  serialize(): Buffer {
    return new Buffer('');
  }

  deserialize(buffer: Buffer): ChildRef<K, V> {
    return new ChildRef(0, {});
  }

  key(): K | null | undefined {
    return this._node.key;
  }

  value(): V | undefined {
    return this._node.value;
  }

  node(): INodeRef<K, V> | undefined {
    return this._node.node;
  }

  _id: number;
  _node: IChild<K, V>;
}
