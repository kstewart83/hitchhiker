import ChildRef from './ChildRef';
import NodeRef from './NodeRef';

export interface Node<K, V> {
  id: number;
  isLeaf: boolean;
  pointers: Pointer<K>[];
  entries: Entry<K, V>[];
}

export interface Entry<K, V> {
  key: K;
  value?: V;
}

export interface Pointer<K> {
  key: K | null;
  nodeId: number;
}

export interface IReference<T> {
  id(): number;
  serialize(): Buffer;
  deserialize(buffer: Buffer): T;
}

export interface Metadata {
  rootId: number;
}

export interface IReferenceStorage {
  newId(): number;
  getMetadata(): Metadata;
  putMetadata(meta: Metadata): void;
  get(id: number): any | undefined;
  put(id: number, ref: any): void;
}
