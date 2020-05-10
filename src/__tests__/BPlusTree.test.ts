import BPlusTree from '../BPlusTree';
import PcgRandom from 'pcg-random';

test('Add simple key with null value', () => {
  const test = new BPlusTree<number, number | null>();
  test.add(0, null);
});

test('Add simple key value', () => {
  const test = new BPlusTree<number, number>();
  test.add(0, 0);
});

test('Find key value after single add', () => {
  const test = new BPlusTree<number, number>();
  test.add(0, 0);
  const result = test.find(0);

  expect(result).toBe(0);
});

test('Find key value after single add of null value', () => {
  const test = new BPlusTree<number, number | null>();
  test.add(0, null);
  const result = test.find(0);

  expect(result).toBe(null);
});

test('Find keys after two adds', () => {
  const test = new BPlusTree<number, number>();
  test.add(0, 0);
  test.add(1, 1);

  expect(test.find(0)).toBe(0);
  expect(test.find(1)).toBe(1);
});

test('Find keys after two adds, reverse order', () => {
  const test = new BPlusTree<number, number>();
  test.add(1, 1);
  test.add(0, 0);

  expect(test.find(0)).toBe(0);
  expect(test.find(1)).toBe(1);
});

test('Insert 25 sequential keys with sequential value pairs, immediate check', () => {
  const total = 25;
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, i);
    expect(test.find(i)).toBe(i);
  }
});

test('Insert 25 random keys with random value pairs, immediate check', () => {
  const total = 25;
  const rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    const k = rng.integer() % 500;
    const v = rng.integer() % 500;
    test.add(k, v);
    expect(test.find(k)).toBe(v);
  }
});

test('Insert 25 random key value pairs twice with duplicate keys and different values', () => {
  let keyRng = new PcgRandom(42);
  let valRng = new PcgRandom(24);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < 25; i++) {
    test.add(keyRng.integer(), valRng.integer());
  }

  keyRng = new PcgRandom(42);
  valRng = new PcgRandom(4242);
  for (let i = 0; i < 25; i++) {
    test.add(keyRng.integer(), valRng.integer());
  }

  keyRng = new PcgRandom(42);
  valRng = new PcgRandom(4242);
  for (let i = 0; i < 25; i++) {
    expect(test.find(keyRng.integer())).toBe(valRng.integer());
  }
});

test('Insert 50 sequential keys with sequential value pairs, immediate check', () => {
  const total = 50;
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, i);
    expect(test.find(i)).toBe(i);
  }
});

test('Insert 50 random keys with random value pairs, immediate check', () => {
  const total = 50;
  const rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    const k = rng.integer() % 500;
    const v = rng.integer() % 500;
    test.add(k, v);
    expect(test.find(k)).toBe(v);
  }
});

test('Insert 100 sequential keys with sequential value pairs, immediate check', () => {
  const total = 100;
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, i);
    expect(test.find(i)).toBe(i);
  }
});

test('Insert 100 random keys with random value pairs, immediate check', () => {
  const total = 100;
  const rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    const k = rng.integer() % 500;
    const v = rng.integer() % 500;
    test.add(k, v);
    expect(test.find(k)).toBe(v);
  }
});

test('Insert 1000 sequential keys with random value pairs', () => {
  const total = 1000;
  let rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, rng.integer() % 5000);
  }

  rng = new PcgRandom(42);
  for (let i = 0; i < total; i++) {
    expect(test.find(i)).toBe(rng.integer() % 5000);
  }
});

test('Insert 1000 random key value pairs', () => {
  const total = 1000;
  let rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(rng.integer(), rng.integer());
  }

  rng = new PcgRandom(42);
  for (let i = 0; i < total; i++) {
    expect(test.find(rng.integer())).toBe(rng.integer());
  }
});

test('Insert 1000 random key value pairs twice with duplicate keys and different values', () => {
  let keyRng = new PcgRandom(42);
  let valRng = new PcgRandom(24);
  const test = new BPlusTree<number, number>();
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

test('Generate DOT graph string', () => {
  const total = 50;
  const rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    const k = rng.integer() % 500;
    const v = rng.integer() % 500;
    test.add(k, v);
    expect(test.find(k)).toBe(v);
  }

  const dot = test.toDOT();
  expect(dot.length).toBeGreaterThan(0);
  // tslint:disable-next-line: no-console
  // console.log(dot);
});
