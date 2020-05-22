import { DataPage } from './DataPage';

export interface Entry<K, V> {
  key: K;
  value?: V;
}

export interface Pointer<K> {
  key: K | null;
  pageId: number;
}

export interface PathElement<K, V> {
  page: DataPage<K, V>;
  index: number;
  found: boolean;
}

export interface IReferenceStorage {
  maxPageSize(): number;
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
