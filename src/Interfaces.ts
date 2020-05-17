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

export interface MetaNode extends Node {
  rootId: number;
}

export interface IReferenceStorage {
  maxNodeSize(): number;
  getMetadata(): Promise<Buffer | undefined>;
  putMetadata(meta: Buffer): Promise<void>;
  get(id: number): Promise<Buffer | undefined>;
  put(id: number, ref: Buffer): Promise<void>;
  free(id: number): Promise<void>;
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
