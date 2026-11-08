import files, { lazyEntries } from "./ObjectCacheFiles.js";
import { BrowserObjectCache } from "./BrowserObjectCache.js";

/**
 * Immutable baked recipes, shared by the CLI and the SPA. Never stores entities.
 */
export class ObjectDataCache {
  /**
   * @type {{version: number, entries: Record<string, Record<string, CacheValue>>}}
   */
  static data = {
    version: 1,
    entries: {},
  };
  /**
   * @type {Promise<void>|null}
   */
  static #loading = null;
  /**
   * @type {Map<string, Map<string, import("./ObjectDataCache.js").CacheValue>>|null}
   */
  static #recording = null;

  /**
   * Load optional SPA chunks before synchronous object construction begins.
   * A failed optional shard falls back to its generators.
   * @returns {Promise<void>}
   */
  static preload() {
    this.#loading ??= this.#load();

    return this.#loading;
  }

  /**
   * @returns {Promise<void>}
   */
  static async #load() {
    const requests = Object.entries(files).filter(ObjectDataCache.#isStartupFile);
    const results = await Promise.allSettled(requests.map(ObjectDataCache.#loadFile));
    const shards = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        shards.push(result.value.default);
      }
    }
    const decoded = this.decode(shards);
    for (const [family, entries] of Object.entries(decoded)) {
      Object.assign(this.data.entries[family] ??= {}, entries);
    }
  }

  /**
   * Reassemble large variants only when all fragments are available.
   * @param {CacheShard[]} shards
   * @returns {Record<string, Record<string, CacheValue>>}
   */
  static decode(shards) {
    const entries = {};
    const fragments = new Map();
    for (const shard of shards) {
      if (shard.version !== 1) {
        continue;
      }
      for (const [family, records] of Object.entries(shard.entries ?? {})) {
        Object.assign(entries[family] ??= {}, records);
      }
      for (const fragment of shard.fragments ?? []) {
        const id = `${fragment.family}/${fragment.key}`;
        if (!fragments.has(id)) {
          fragments.set(id, {
            family: fragment.family,
            key: fragment.key,
            total: fragment.total,
            parts: new Map(),
          });
        }
        fragments.get(id).parts.set(fragment.index, fragment.text);
      }
    }
    for (const { family, key, total, parts } of fragments.values()) {
      if (parts.size !== total) {
        continue;
      }
      try {
        const text = Array.from({ length: total }, /**
         *
         * @param {undefined} _
         * @param {number} index
         */
          (_, index) => parts.get(index)).join("");
        (entries[family] ??= {})[key] = JSON.parse(text);
      } catch {
        // Incomplete/corrupt optional data must leave the generator available.
      }
    }

    return entries;
  }

  /**
   * @param {[string, () => Promise<{default: CacheShard}>]} entry
   * @returns {Promise<{default: CacheShard}>}
   */
  static #loadFile([path, load]) {
    return BrowserObjectCache.load(path, load);
  }

  /**
   * Large map and castle snapshots must not preload unrelated maps.
   * @param {[string, () => Promise<{default: CacheShard}>]} entry
   * @returns {boolean}
   */
  static #isStartupFile([path]) {
    return !/^\.\/generated\/(castle-plans|compiled-maps)\//.test(path);
  }

  /**
   * Stable content key. Quantization removes transform round-off below 10 nm.
   * @param {CacheValue} value
   * @returns {string}
   */
  static key(value) {
    const text = JSON.stringify(this.#normalize(value));
    let first = 2166136261, second = 5381;
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = Math.imul(second, 33) ^ code;
    }

    return `${text.length}:${first.toString(16)}:${(second >>> 0).toString(16)}`;
  }

  /**
   * Hits skip the generator entirely; each consumer receives private mutable data.
   * @template T
   * @param {string} family
   * @param {CacheValue} input
   * @param {() => T} generate
   * @returns {T}
   */
  static resolve(family, input, generate) {
    const entries = this.data.version === 1 ? this.data.entries[family] : null;
    if (!this.#recording && !entries) {
      return generate();
    }
    const key = this.key(input);
    if (!this.#recording && entries && Object.hasOwn(entries, key)) {
      return structuredClone(entries[key]);
    }
    const result = generate();
    if (this.#recording) {
      if (!this.#recording.has(family)) {
        this.#recording.set(family, new Map());
      }
      this.#recording.get(family).set(key, structuredClone(result));
    }
    return result;
  }

  /**
   * Async generators share baked storage and clone semantics with synchronous recipes.
   * @template T
   * @param {string} family
   * @param {CacheValue} input
   * @param {() => Promise<T>} generate
   * @returns {Promise<T>}
   */
  static async resolveAsync(family, input, generate) {
    if (!this.#recording) {
      const paths = lazyEntries[`${family}/${this.key(input)}`];
      if (paths && !Object.hasOwn(this.data.entries[family] ?? {}, this.key(input))) {
        const results = await Promise.allSettled(paths.map(ObjectDataCache.#loadPath));
        const shards = results.filter(ObjectDataCache.#fulfilled).map(ObjectDataCache.#shard);
        const decoded = this.decode(shards);
        for (const [name, entries] of Object.entries(decoded)) {
          Object.assign(this.data.entries[name] ??= {}, entries);
        }
      }
    }
    const entries = this.data.version === 1 ? this.data.entries[family] : null;
    if (!this.#recording && !entries) {
      return generate();
    }
    const key = this.key(input);
    if (!this.#recording && entries && Object.hasOwn(entries, key)) {
      return structuredClone(entries[key]);
    }
    const result = await generate();
    if (this.#recording) {
      if (!this.#recording.has(family)) {
        this.#recording.set(family, new Map());
      }
      this.#recording.get(family).set(key, structuredClone(result));
    }

    return result;
  }

  /**
   * @param {string} path
   * @returns {Promise<{default: CacheShard}>}
   */
  static #loadPath(path) {
    return ObjectDataCache.#loadFile([path, files[path]]);
  }

  /**
   * @param {PromiseSettledResult<{default: CacheShard}>} result
   * @returns {boolean}
   */
  static #fulfilled(result) {
    return result.status === "fulfilled";
  }

  /**
   * @param {PromiseFulfilledResult<{default: CacheShard}>} result
   * @returns {CacheShard}
   */
  static #shard(result) {
    return result.value.default;
  }

  /**
   * CLI explicitly bypasses existing data while baking.
   */
  static beginRecording() {
    this.#recording = new Map();
  }

  /**
   * @returns {{version: number, entries: Record<string, Record<string, CacheValue>>}}
   */
  static finishRecording() {
    const entries = {};
    for (const [family, records] of this.#recording ?? []) {
      entries[family] = Object.fromEntries(records);
    }
    this.#recording = null;

    return {
      version: 1,
      entries,
    };
  }

  /**
   * @param {CacheValue} value
   * @returns {CacheValue}
   */
  static #normalize(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 1e8) / 1e8;
    }
    if (Array.isArray(value)) {
      return value.map(this.#normalize.bind(this));
    }
    if (value && typeof value === "object") {
      const result = {};
      for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) {
          result[key] = this.#normalize(value[key]);
        }
      }

      return result;
    }
    return value;
  }
}

/**
 * @typedef {null|boolean|number|string|CacheValue[]|{[key: string]: CacheValue}} CacheValue
 */

/**
 * @typedef {{version:number,entries?:Record<string,Record<string,CacheValue>>,fragments?:Array<{family:string,key:string,index:number,total:number,text:string}>}} CacheShard
 */
