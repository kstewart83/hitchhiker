/* istanbul ignore file */
import BPlusTree from './BPlusTree';
import PcgRandom from 'pcg-random';
import { DynamoStorage } from './DynamoStorage';
import DefaultStorageDriver from './DefaultStorageDriver';
import { MemoryStorage } from './MemoryStorage';

export default BPlusTree;
export { BPlusTree };
// tslint:disable: no-console

async function main() {
  // const storage = new DynamoStorage('TestTable');
  const storage = new MemoryStorage();
  const driver = new DefaultStorageDriver(storage);
  const test = new BPlusTree<number, number>(driver);
  const entries: any = {};
  const total = 500;
  const timings: bigint[] = [];
  const rng = new PcgRandom(total);
  timings.push(process.hrtime.bigint());
  for (let i = 0; i < total; i++) {
    const k = rng.integer(total * 10);
    const v = rng.integer(total * 10);
    entries[k] = v;
    await test.add(k, v);
    if (i % 10 === 0) {
      console.log('a = ', i);
    }
    timings.push(process.hrtime.bigint());
  }

  let str = await test.toDOT();

  /*

  for (let i = 0; i < total; i++) {
    const keys = Object.keys(entries);
    const nextIndex = rng.integer(keys.length);
    const nextKey = parseInt(keys[nextIndex], 10);
    const nextValue = entries[nextKey];
    const result = await test.find(nextKey);

    if (i % 10 === 0) {
      // console.log('r = ', i);
      if (result !== nextValue) {
        console.log(`${result} !== ${nextValue}`);
      } else {
        console.log(`${result} === ${nextValue}`);
      }
    }
  }

  str = await test.toDOT();
  */

  for (let i = total - 1; i >= 0; i--) {
    const keys = Object.keys(entries);
    const nextIndex = rng.integer(keys.length);
    const nextKey = parseInt(keys[nextIndex], 10);
    const nextValue = entries[nextKey];
    const result = await test.delete(nextKey);
    if (i % 10 === 0) {
      console.log('d = ', i);
    }
    if (result !== nextValue) {
      console.log(result, ' !== ', nextValue);
      throw new Error();
    }
    timings.push(process.hrtime.bigint());
    delete entries[nextKey];
  }

  str = await test.toDOT();

  for (let i = 0; i < total; i++) {
    // str = await test.toDOT();
    const k = rng.integer(total * 10);
    const v = rng.integer(total * 10);
    entries[k] = v;
    await test.add(k, v);
    if (i % 10 === 0) {
      console.log('a = ', i);
    }
    timings.push(process.hrtime.bigint());
  }

  str = await test.toDOT();
  console.log((timings[timings.length - 1] - timings[0]) / BigInt(1));
  console.log((timings[timings.length - 1] - timings[0]) / BigInt(1000000));
}

main().catch((e) => console.error(e));
