import { IStorage } from './Interfaces';

export class MemoryStorage implements IStorage {
  public constructor() {
    this._data = {};
  }

  *generator(count?: number) {
    function* entries(obj: { [key: number]: Buffer }) {
      for (const key of Object.keys(obj)) {
        const k = parseInt(key, 10);
        yield {
          key: k,
          value: obj[k],
        };
      }
    }

    const keys = entries(this._data);

    let i = 0;
    let nextEntry = keys.next();
    while (!nextEntry.done) {
      yield {
        key: nextEntry.value.key,
        buffer: nextEntry.value.value,
      };
      if (count && i++ > count) {
        return false;
      }
      nextEntry = keys.next();
    }
    return true;
  }

  async get(id: number): Promise<Buffer | undefined> {
    return this._data[id];
  }

  async put(id: number, ref: Buffer): Promise<void> {
    this._data[id] = ref;
  }

  private _data: { [key: number]: Buffer };
}
