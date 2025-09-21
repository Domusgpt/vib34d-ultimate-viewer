export class SeededRandom {
    constructor(seed = 1) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        // Use a simple LCG (Lehmer) for determinism across browsers
        this.state = (seed >>> 0) || 1;
    }

    next() {
        // Park-Miller LCG
        this.state = (this.state * 48271) % 0x7fffffff;
        return this.state / 0x7fffffff;
    }

    range(min, max) {
        return min + (max - min) * this.next();
    }

    pick(array) {
        if (!array.length) return undefined;
        const index = Math.floor(this.next() * array.length);
        return array[index];
    }
}
