/**
 * Optional persistent storage for immutable, content-addressed recipe shards.
 */
export class BrowserObjectCache {
  /**
   * @param {string} path
   * @param {() => Promise<{default: import("./ObjectDataCache.js").CacheShard}>} load
   * @returns {Promise<{default: import("./ObjectDataCache.js").CacheShard}>}
   */
  static async load(path, load) {
    let cache;
    let key;
    try {
      if (globalThis.caches && globalThis.location && /\/[a-f\d]+\.json$/.test(path)) {
        cache = await globalThis.caches.open("game-object-recipes-v1");
        key = new URL(`./object-recipes/${path.replace("./generated/", "")}`, globalThis.location.origin).href;
        const response = await cache.match(key);
        if (response) {
          const shard = await response.json();
          if (shard?.version === 1 && shard.entries) {
            return { default: shard };
          }
        }
      }
    } catch {
      // Storage denial, corruption, or eviction must never prevent loading.
    }
    const result = await load();
    if (cache && key) {
      try {
        await cache.put(key, new Response(JSON.stringify(result.default), {
          headers: { "Content-Type": "application/json" },
        }));
      } catch {
        // Quota limits and private browsing retain the normal network path.
      }
    }

    return result;
  }
}
