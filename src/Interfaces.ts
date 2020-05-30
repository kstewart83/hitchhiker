export interface IStorageDriver {
  maxPageSize(): number;
  getMetadata(): Promise<Buffer | undefined>;
  putMetadata(meta: Buffer): Promise<void>;
  get(id: number): Promise<Buffer | undefined>;
  put(id: number, ref: Buffer): Promise<void>;
  free(id: number): Promise<void>;
  generator(
    count?: number,
  ): AsyncGenerator<
    {
      key: number;
      buffer: Buffer;
    },
    boolean,
    number
  >;
}

export interface IStorageOptions {
  supportsInternalDelete: boolean;
  maxNodeSize: number;
}

export interface IStorage {
  options(): IStorageOptions;
  get(id: number): Promise<Buffer | undefined>;
  put(id: number, ref: Buffer): Promise<void>;
  generator(
    count?: number,
  ): AsyncGenerator<
    {
      key: number;
      buffer: Buffer;
    },
    boolean,
    number
  >;
}
