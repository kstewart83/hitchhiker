import { IReferenceStorage } from './Interfaces';

export enum PageType {
  Data = 1,
  Meta = 2,
}

export class Page {
  id: number;
  type: PageType;
  hash?: Buffer;
  serialization?: Buffer;

  static load(storage: IReferenceStorage): Page {
    throw new Error('Not implemented');
  }

  constructor(id: number, type: PageType) {
    this.id = id;
    this.type = type;
  }
}

export default Page;
