import ChildRef from './ChildRef';
import NodeRef from './NodeRef';

export interface Node<K, V> {
  isLeaf: boolean;
  parent: Node<K, V> | null;
  children: Child<K, V>[];
}

export interface Child<K, V> {
  key?: K | null;
  value?: V;
  node?: Node<K, V>;
}

export interface IReference<T> {
  id: () => number;
  serialize: () => Buffer;
  deserialize: (buffer: Buffer) => T;
}

export interface INode<K, V> {
  isLeaf: boolean;
  parent: NodeRef<K, V> | null;
  children: ChildRef<K, V>[];
}

export interface IChild<K, V> {
  key?: K | null;
  value?: V;
  node?: NodeRef<K, V>;
}

export interface IReferenceStorage {
  new: () => number;
  get<T>(id: number): IReference<T> | undefined;
  put<T>(id: number, ref: IReference<T>): void;
}
