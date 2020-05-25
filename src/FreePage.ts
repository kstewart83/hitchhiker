import Page, { PageType } from './Page';
import * as cbor from 'cbor';
import { IReferenceStorage } from './Interfaces';
import MemoryStorage from './MemoryStorage';

export class FreePage extends Page {
  detached: boolean;

  constructor(id: number, detached: boolean) {
    super(id, PageType.Free);
    this.detached = detached;
  }

  async serializeFreePage(): Promise<Buffer> {
    const data = this.detached;

    return cbor.encode(this.id, this.type, data);
  }

  static deserializeFreePage(id: number, data: any): FreePage {
    return new FreePage(id, data);
  }

  async freePageToDOT(internalId: number, storage: IReferenceStorage): Promise<string> {
    let str = '';
    if (this.detached) {
      str += `n${internalId} [fillcolor="#ffaaff", style=filled, label="I${internalId}|D"]\n`;
    } else {
      str += `n${internalId} [fillcolor="#ffaa88", style=filled, label="I${internalId}"]\n`;
    }
    if (storage instanceof MemoryStorage) {
      const memStor = storage as MemoryStorage;
      str += `n${memStor.FreeMapMetadataId} -> n${internalId}\n`;
    }
    return str;
  }
}
