import Page, { PageType } from './Page';
import * as cbor from 'cbor';
import { IReferenceStorage } from './Interfaces';
import MemoryStorage from './MemoryStorage';

export class MetaPage extends Page {
  rootId: number;

  constructor(id: number, rootId: number) {
    super(id, PageType.Meta);
    this.rootId = rootId;
  }

  async serializeMetaPage(): Promise<Buffer> {
    const data = this.rootId;

    return cbor.encode(this.id, this.type, data);
  }

  static deserializeMetaPage(id: number, data: any): MetaPage {
    return new MetaPage(id, data);
  }

  async metaPageToDOT(internalId: number, storage: IReferenceStorage): Promise<string> {
    let str = `tree -> n${internalId}\n`;
    if (storage instanceof MemoryStorage) {
      const memStor = storage as MemoryStorage;
      if (internalId === memStor.DataMetadataId) {
        str += `n${internalId} [label="Data"]\n`;
      } else if (internalId === memStor.IdMapMetadataId) {
        str += `n${internalId} [label="ID Map"]\n`;
      } else if (internalId === memStor.FreeMapMetadataId) {
        str += `n${internalId} [label="Free Map"]\n`;
      } else {
        str += `n${internalId} [label="M${this.id}:I${internalId}"]\n`;
      }
    } else {
      str += `n${internalId} [label="M${this.id}:I${internalId}"]\n`;
    }
    str += `n${internalId} -> n${this.rootId}\n`;
    return str;
  }
}
