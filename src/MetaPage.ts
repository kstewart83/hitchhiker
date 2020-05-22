import Page, { PageType } from './Page';
import * as cbor from 'cbor';

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
}
