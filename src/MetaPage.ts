import Page, { PageType } from './Page';

export class MetaPage extends Page {
  rootId: number;

  constructor(id: number, rootId: number) {
    super(id, PageType.Meta);
    this.rootId = rootId;
  }
}
