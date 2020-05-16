export interface Node {
  id: number;
  type: NodeType;
}

export enum NodeType {
  Data = 1,
  Meta = 2,
}

export interface DataNode<K, V> extends Node {
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

export interface PathElement<K, V> {
  node: DataNode<K, V>;
  index: number;
  found: boolean;
}

export interface IReference<T> {
  id(): number;
  serialize(): Buffer;
  deserialize(buffer: Buffer): T;
}

export interface MetaNode extends Node {
  rootId: number;
}

export interface IReferenceStorage {
  maxNodeSize(): number;
  getMetadata(): Buffer | undefined;
  putMetadata(meta: Buffer): void;
  get(id: number): Buffer | undefined;
  put(id: number, ref: Buffer): void;
  free(id: number): Buffer | undefined;
  generator(
    count?: number,
  ): Generator<
    {
      key: number;
      buffer: Buffer;
    },
    boolean,
    number
  >;
}
