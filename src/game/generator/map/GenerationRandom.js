
/**
 * One seeded random stream per generation; preserves draw order across collaborators.
 */
export class GenerationRandom {
  /**
   * @type {() => number}
   */
  #random;

  /**
   * @param {string} [mapName]
   */
  constructor(mapName) {
    this.#random =
      mapName === undefined ? Math.random : this.#createSeededRandom(mapName);
  }

  /**
   * @param {number} min
   * @param {number} max
   */
  rng(min, max) {
    return Math.floor(this.#random() * (max - min + 1)) + min;
  }

  /**
   * @param {string} mapName
   */
  #createSeededRandom(mapName) {
    let state = this.hashMapName(mapName);

    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
    };
  }

  /**
   * @param {string} mapName
   */
  hashMapName(mapName) {
    let hash = 0x811c9dc5;
    for (const character of mapName) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * @param {string} mapName
   * @param {number} salt
   * @param {number} chance
   */
  deterministicChance(mapName, salt, chance) {
    return this.hashMapName(`${mapName}:${salt}`) % 100 < chance;
  }

  /**
   * @template T
   * @param {T[]} items
   * @returns {T}
   */
  randomItem(items) {
    return items[this.rng(0, items.length - 1)];
  }

  /**
   * @template T
   * @param {T[]} items
   * @returns {T[]}
   */
  shuffle(items) {
    for (let index = items.length - 1; index > 0; index--) {
      const swapIndex = this.rng(0, index);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }
}
