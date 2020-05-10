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
  maxNodeSize(): number;
  getMetadata(): Buffer | undefined;
  putMetadata(meta: Buffer): void;
  get(id: number): Buffer | undefined;
  put(id: number, ref: Buffer): void;
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
