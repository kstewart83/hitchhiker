import BPlusTree from '../BPlusTree';
import PcgRandom from 'pcg-random';

test('Add simple key with null value', () => {
  const test = new BPlusTree<number, number | null>(5);
  test.add(0, null);
});

test('Add simple key value', () => {
  const test = new BPlusTree<number, number>(5);
  test.add(0, 0);
});

test('Find key value after single add', () => {
  const test = new BPlusTree<number, number>(5);
  test.add(0, 0);
  const result = test.find(0);

  expect(result).toBe(0);
});

test('Find key value after single add of null value', () => {
  const test = new BPlusTree<number, number | null>(5);
  test.add(0, null);
  const result = test.find(0);

  expect(result).toBe(null);
});

test('Find keys after two adds', () => {
  const test = new BPlusTree<number, number>(5);
  test.add(0, 0);
  test.add(1, 1);

  expect(test.find(0)).toBe(0);
  expect(test.find(1)).toBe(1);
});

test('Find keys after two adds, reverse order', () => {
  const test = new BPlusTree<number, number>(5);
  test.add(1, 1);
  test.add(0, 0);

  expect(test.find(0)).toBe(0);
  expect(test.find(1)).toBe(1);
});

test('Fill root node up to branching factor minus 1', () => {
  const branchingFactor = 5;
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < branchingFactor - 1; i++) {
    test.add(i, i);
  }

  for (let i = 0; i < branchingFactor - 1; i++) {
    expect(test.find(i)).toBe(i);
  }
});

test('Fill root node up to branching factor minus 1, reverse order', () => {
  const branchingFactor = 5;
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = branchingFactor - 1; i > 0; i--) {
    test.add(i, i);
  }

  for (let i = branchingFactor - 1; i > 0; i--) {
    expect(test.find(i)).toBe(i);
  }
});

test('Fill root node up to branching factor', () => {
  const branchingFactor = 5;
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < branchingFactor; i++) {
    test.add(i, i);
  }

  for (let i = 0; i < branchingFactor; i++) {
    expect(test.find(i)).toBe(i);
  }
});

test('Fill root node up to branching factor plus 1', () => {
  const branchingFactor = 5;
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < branchingFactor + 1; i++) {
    test.add(i, i);
  }

  for (let i = 0; i < branchingFactor + 1; i++) {
    expect(test.find(i)).toBe(i);
  }
});

test('Insert 20 sequential keys with sequential value pairs, immediate check', () => {
  const branchingFactor = 5;
  const total = 20;
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < total; i++) {
    test.add(i, i);
    expect(test.find(i)).toBe(i);
  }
});

test('Insert 1000 sequential keys with random value pairs', () => {
  const branchingFactor = 5;
  const total = 1000;
  let rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < total; i++) {
    test.add(i, rng.integer());
  }

  rng = new PcgRandom(42);
  for (let i = 0; i < total; i++) {
    expect(test.find(i)).toBe(rng.integer());
  }
});

test('Insert 1000 random key value pairs', () => {
  const branchingFactor = 5;
  const total = 100;
  let rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < total; i++) {
    test.add(rng.integer(), rng.integer());
  }

  rng = new PcgRandom(42);
  for (let i = 0; i < total; i++) {
    expect(test.find(rng.integer())).toBe(rng.integer());
  }
});

test('Insert 1000 random key value pairs twice with duplicate keys and different values', () => {
  const branchingFactor = 5;
  let keyRng = new PcgRandom(42);
  let valRng = new PcgRandom(24);
  const test = new BPlusTree<number, number>(branchingFactor);
  for (let i = 0; i < 1000; i++) {
    test.add(keyRng.integer(), valRng.integer());
  }

  keyRng = new PcgRandom(42);
  valRng = new PcgRandom(4242);
  for (let i = 0; i < 1000; i++) {
    test.add(keyRng.integer(), valRng.integer());
  }

  keyRng = new PcgRandom(42);
  valRng = new PcgRandom(4242);
  for (let i = 0; i < 1000; i++) {
    expect(test.find(keyRng.integer())).toBe(valRng.integer());
  }
});
