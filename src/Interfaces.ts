import ChildRef from './ChildRef';
import NodeRef from './NodeRef';

export interface Node<K, V> {
  id: number;
  isLeaf: boolean;
  children: Child<K, V>[];
  childrenId: number[];
}

export interface Child<K, V> {
  id: number;
  key?: K | null;
  value?: V;
  node?: Node<K, V>;
  nodeId?: number;
}

export interface IReference<T> {
  id(): number;
  serialize(): Buffer;
  deserialize(buffer: Buffer): T;
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
  newId(): number;
  getMetadata(): any;
  putMetadata(meta: any): void;
  get(id: number): any | undefined;
  put(id: number, ref: any): void;
}
