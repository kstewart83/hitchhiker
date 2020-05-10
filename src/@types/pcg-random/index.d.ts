declare module 'pcg-random' {
  export class PcgRandom {
    /**
     * PcgRandom's construction takes 4 arguments, all optional.
     *
     * @param seedHi The high 32 bits of the seed.
     * @param seedLo The how 32 bits of the seed.
     * @param incHi The high 32 bits of the incrementer.
     * @param incLo The low 32 bits of the incrementer.
     */
    constructor(seedHi?: number, seedLo?: number, incHi?: number, incLo?: number);

    /**
     * Seed the PcgRandom and optionally change the value of its incrementer.
     *
     * @param seedHi The high 32 bits of the seed.
     * @param seedLo The how 32 bits of the seed.
     * @param incHi The high 32 bits of the incrementer.
     * @param incLo The low 32 bits of the incrementer.
     */
    setSeed(seedHi?: number, seedLo?: number, incHi?: number, incLo?: number): void;

    /**
     * Returns a copy of the internal state of this random number generator
     * as a JavaScript Array.
     *
     * @returns The PCG state
     */
    getState(): any[];

    /**
     * Uses state returned from {@link getState} to set PCG state
     *
     * @param state The PCG state
     */
    setState(state: any[]): void;

    /**
     * Get a uniformly distributed 32 bit integer between 0 (inclusive) and
     * a specified value (exclusive). If the maximum value isn't specified,
     * the function will return a uniformly distributed 32 bit integer, with
     * no maximum.
     *
     * @param max Optionally an upper bound for the integer
     */
    integer(max?: number): number;

    /**
     * Get a uniformly distributed IEEE-754 double between 0.0 and 1.0, with
     * 53 bits of precision (every bit of the mantissa is randomized)
     */
    number(): number;
  }
}
