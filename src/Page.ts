import { IReferenceStorage } from './Interfaces';
import * as cbor from 'cbor';

export enum PageType {
  Data = 1,
  Meta = 2,
}

export class Page {
  id: number;
  type: PageType;
  hash?: Buffer;
  serialization?: Buffer;

  static async deserializePage(cborData: Buffer): Promise<{ refId: number; refType: PageType; data: any }> {
    const decodeArray = await cbor.decodeAll(cborData);
    const refId = decodeArray[0] as number;
    const refType = decodeArray[1] as number;
    const data = decodeArray[2] as any;

    return {
      refId,
      refType,
      data,
    };
  }

  constructor(id: number, type: PageType) {
    this.id = id;
    this.type = type;
  }
}

export default Page;
