/* istanbul ignore file */
import BPlusTree from './BPlusTree';
import PcgRandom from 'pcg-random';
import { DynamoStorage } from './DynamoStorage';

export default BPlusTree;
export { BPlusTree };
// tslint:disable: no-console

const dynamoStorage = new DynamoStorage('TestTable');
const test = new BPlusTree<number, number>(dynamoStorage);
const entries: any = {};
const total = 50;
const timings: bigint[] = [];
const rng = new PcgRandom(total);
timings.push(process.hrtime.bigint());
for (let i = 0; i < total; i++) {
  entries[i] = i;
  test.add(i, i);
  if (i % 10 === 0) {
    console.log('i = ', i);
  }
  timings.push(process.hrtime.bigint());
}

for (let i = total - 1; i >= 0; i--) {
  const keys = Object.keys(entries);
  const nextIndex = rng.integer(keys.length);
  const nextKey = parseInt(keys[nextIndex], 10);
  const nextValue = entries[nextKey];
  const result = test.delete(nextKey);
  if (i % 10 === 0) {
    console.log('i = ', i);
  }
  if (result !== nextValue) {
    throw new Error();
  }
  timings.push(process.hrtime.bigint());
  delete entries[nextKey];
}

console.log((timings[timings.length - 1] - timings[0]) / BigInt(1));
console.log((timings[timings.length - 1] - timings[0]) / BigInt(1000000));
