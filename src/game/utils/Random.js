/**
 * Deterministic random utilities for seeded gameplay.
 * Provides simple Mulberry32 implementation and helpers.
 */

/**
 * Mulberry32 RNG implementation.
 * @param {number} seed - unsigned 32-bit seed
 * @returns {() => number} function returning floats in [0, 1)
 */
export function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Creates a RNG helper with common convenience methods.
 * @param {number} seed
 */
export function createSeededRNG(seed) {
    const rand = mulberry32(seed);
    return {
        nextFloat: () => rand(),
        nextRange: (min, max) => min + (max - min) * rand(),
        nextInt: (min, max) => Math.floor(min + (max - min + 1) * rand()),
        choose: (array) => array[Math.floor(rand() * array.length)],
        shuffle(array) {
            const copy = array.slice();
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }
    };
}

/**
 * Hash string into a numeric seed for deterministic RNG.
 * @param {string} str
 */
export function hashStringToSeed(str) {
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 >>> 0) ^ (h2 >>> 0);
}
