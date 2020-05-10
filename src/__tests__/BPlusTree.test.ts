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

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %d sequential keys with sequential value pairs, immediate check',
  (total: number) => {
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      test.add(i, i);
      expect(test.find(i)).toBe(i);
    }
  },
);

test.each([25, 50])('Insert %d sequential keys with sequential value pairs, then delete all keys', (total: number) => {
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, i);
    const str = test.toDOT();
  }

  for (let i = 0; i < total; i++) {
    const result = test.delete(i);
    const str = test.toDOT();
    expect(result).toBe(i);
    expect(test.find(i)).toBeUndefined();
  }
});

test.each([25, 50, 100, 250, 500, 1000])('Insert %i sequential keys with random value pairs', (total: number) => {
  let rng = new PcgRandom(total);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    test.add(i, rng.integer());
  }

  rng = new PcgRandom(total);
  for (let i = 0; i < total; i++) {
    expect(test.find(i)).toBe(rng.integer());
  }
});

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %d random keys with random value pairs, immediate check',
  (total: number) => {
    const rng = new PcgRandom(total);
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      const k = rng.integer();
      const v = rng.integer();
      test.add(k, v);
      expect(test.find(k)).toBe(v);
    }
  },
);

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %i random key value pairs twice with duplicate keys and different values',
  (total: number) => {
    let keyRng = new PcgRandom(total);
    let valRng = new PcgRandom(keyRng.integer());
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      test.add(keyRng.integer(), valRng.integer());
    }

    keyRng = new PcgRandom(total);
    valRng = new PcgRandom(keyRng.integer());
    for (let i = 0; i < total; i++) {
      test.add(keyRng.integer(), valRng.integer());
    }

    keyRng = new PcgRandom(total);
    valRng = new PcgRandom(keyRng.integer());
    for (let i = 0; i < total; i++) {
      expect(test.find(keyRng.integer())).toBe(valRng.integer());
    }
  },
);

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
