import BPlusTree from '../BPlusTree';
import PcgRandom from 'pcg-random';

test('Add simple key with null value', async () => {
  const test = new BPlusTree<number, number | null>();
  await test.add(0, null);
});

test('Add simple key value', async () => {
  const test = new BPlusTree<number, number>();
  await test.add(0, 0);
});

test('Find key value after single add', async () => {
  const test = new BPlusTree<number, number>();
  await test.add(0, 0);
  const result = await test.find(0);

  expect(result).toBe(0);
});

test('Find key value after single add of null value', async () => {
  const test = new BPlusTree<number, number | null>();
  await test.add(0, null);
  const result = await test.find(0);

  expect(result).toBe(null);
});

test('Find keys after two adds', async () => {
  const test = new BPlusTree<number, number>();
  await test.add(0, 0);
  await test.add(1, 1);

  expect(await test.find(0)).toBe(0);
  expect(await test.find(1)).toBe(1);
});

test('Find keys after two adds, reverse order', async () => {
  const test = new BPlusTree<number, number>();
  await test.add(1, 1);
  await test.add(0, 0);

  expect(await test.find(0)).toBe(0);
  expect(await test.find(1)).toBe(1);
});

test.each([25, 50, 100, 500])(
  'Insert %d sequential keys with sequential value pairs, immediate check',
  async (total: number) => {
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      await test.add(i, i);
      expect(await test.find(i)).toBe(i);
    }
  },
);

test.each([25, 50, 100, 500])(
  'Insert %d sequential keys with sequential value pairs, then sequentially delete all keys',
  async (total: number) => {
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      await test.add(i, i);
    }

    for (let i = 0; i < total; i++) {
      const result = await test.delete(i);
      expect(result).toBe(i);
      expect(await test.find(i)).toBeUndefined();
    }
  },
);

test.each([25, 50, 100, 500])(
  'Insert %d sequential keys with sequential value pairs, then delete all keys in reverse order',
  async (total: number) => {
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      await test.add(i, i);
    }

    for (let i = total - 1; i >= 0; i--) {
      const result = await test.delete(i);
      expect(result).toBe(i);
      expect(await test.find(i)).toBeUndefined();
    }
  },
);

test.each([25, 50, 100, 500])(
  'Insert %d sequential keys with sequential value pairs, then delete all keys in random order',
  async (total: number) => {
    const test = new BPlusTree<number, number>();
    const entries: any = {};
    const rng = new PcgRandom(total);
    for (let i = 0; i < total; i++) {
      entries[i] = i;
      await test.add(i, i);
    }

    for (let i = total - 1; i >= 0; i--) {
      const keys = Object.keys(entries);
      const nextIndex = rng.integer(keys.length);
      const nextKey = parseInt(keys[nextIndex], 10);
      const nextValue = entries[nextKey];
      const result = await test.delete(nextKey);
      expect(result).toBe(nextValue);
      expect(await test.find(nextKey)).toBeUndefined();
      delete entries[nextKey];
    }
  },
);

test.each([25, 50, 100, 250, 500])(
  'Insert %d random key/value pairs, then delete all keys in random order',
  async (total: number) => {
    const test = new BPlusTree<number, number>();
    const entries: any = {};
    const rng = new PcgRandom(total);
    for (let i = 0; i < total; i++) {
      const k = rng.integer() % 250;
      const v = rng.integer() % 250;
      entries[k] = v;
      await test.add(k, v);
    }

    for (let i = total - 1; i >= 0; i--) {
      const keys = Object.keys(entries);
      const nextIndex = rng.integer(keys.length);
      const nextKey = parseInt(keys[nextIndex], 10);
      const nextValue = entries[nextKey];
      const result = await test.delete(nextKey);
      expect(result).toBe(nextValue);
      expect(await test.find(nextKey)).toBeUndefined();
      delete entries[nextKey];
    }
  },
);

test.each([25, 50, 100, 250, 500, 1000])('Insert %i sequential keys with random value pairs', async (total: number) => {
  let rng = new PcgRandom(total);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    await test.add(i, rng.integer());
  }

  rng = new PcgRandom(total);
  for (let i = 0; i < total; i++) {
    expect(await test.find(i)).toBe(rng.integer());
  }
});

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %d random keys with random value pairs, immediate check',
  async (total: number) => {
    const rng = new PcgRandom(total);
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      const k = rng.integer();
      const v = rng.integer();
      await test.add(k, v);
      expect(await test.find(k)).toBe(v);
    }
  },
);

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %d random keys with random value pairs, delete keys in insertion order',
  async (total: number) => {
    let rng = new PcgRandom(total);
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      const k = rng.integer();
      const v = rng.integer();
      await test.add(k, v);
    }

    rng = new PcgRandom(total);
    for (let i = 0; i < total; i++) {
      const k = rng.integer();
      const v = rng.integer();
      const result = await test.delete(k);
      expect(result).toBe(v);
      expect(await test.find(k)).toBeUndefined();
    }
  },
);

test.each([25, 50, 100, 250, 500, 1000])(
  'Insert %i random key value pairs twice with duplicate keys and different values',
  async (total: number) => {
    let keyRng = new PcgRandom(total);
    let valRng = new PcgRandom(keyRng.integer());
    const test = new BPlusTree<number, number>();
    for (let i = 0; i < total; i++) {
      await test.add(keyRng.integer(), valRng.integer());
    }

    keyRng = new PcgRandom(total);
    valRng = new PcgRandom(keyRng.integer());
    for (let i = 0; i < total; i++) {
      await test.add(keyRng.integer(), valRng.integer());
    }

    keyRng = new PcgRandom(total);
    valRng = new PcgRandom(keyRng.integer());
    for (let i = 0; i < total; i++) {
      expect(await test.find(keyRng.integer())).toBe(valRng.integer());
    }
  },
);

test('Generate DOT graph string', async () => {
  const total = 500;
  const rng = new PcgRandom(42);
  const test = new BPlusTree<number, number>();
  for (let i = 0; i < total; i++) {
    const k = rng.integer() % 1000;
    const v = rng.integer() % 1000;
    await test.add(k, v);
    expect(await test.find(k)).toBe(v);
  }

  const dot = await test.toDOT();
  expect(dot.length).toBeGreaterThan(0);
});
