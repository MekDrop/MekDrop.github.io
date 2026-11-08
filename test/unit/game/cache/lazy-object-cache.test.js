import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, copyFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";

test("startup omits large snapshots and async lookup loads only the selected complete variant", async () => {
  const root = await mkdtemp(resolve("tmp/lazy-cache-"));
  try {
    for (const file of ["ObjectDataCache.js", "BrowserObjectCache.js"]) {
      await copyFile(new URL(`../../../../src/game/cache/${file}`, import.meta.url), join(root, file));
    }
    const key = ObjectDataCache.key({ seed: 1 });
    const source = `
export const calls = [];
const file = (path, shard) => async () => { calls.push(path); return {default:shard}; };
export default {
  './generated/books/ab.json': file('books', {version:1,entries:{books:{book:[1]}}}),
  './generated/castle-plans/cd.json': file('castle', {version:1,entries:{'castle-plans':{${JSON.stringify(key)}:[2]}}}),
  './generated/castle-plans/ef.json': file('unrelated', {version:1,entries:{'castle-plans':{other:[3]}}}),
  './generated/compiled-maps/ab.json': file('map', {version:1,entries:{}})
};
export const lazyEntries = {${JSON.stringify('castle-plans/' + key)}:['./generated/castle-plans/cd.json']};
`;
    await writeFile(join(root, "ObjectCacheFiles.js"), source);
    const { ObjectDataCache: cache } = await import(new URL(`file:///${join(root, "ObjectDataCache.js").replaceAll("\\", "/")}`));
    const { calls } = await import(new URL(`file:///${join(root, "ObjectCacheFiles.js").replaceAll("\\", "/")}`));
    await cache.preload();
    assert.deepEqual(calls, ["books"]);
    const actual = await cache.resolveAsync("castle-plans", { seed: 1 }, async () => assert.fail("cache miss"));
    assert.deepEqual(actual, [2]);
    assert.deepEqual(calls, ["books", "castle"]);
    actual[0] = 99;
    assert.deepEqual(await cache.resolveAsync("castle-plans", { seed: 1 }, async () => []), [2]);
    assert.deepEqual(calls, ["books", "castle"]);
    assert.equal(await cache.resolveAsync("castle-plans", { seed: 2 }, async () => 42), 42);
  } finally {
    assert.equal(root.startsWith(resolve("tmp") + "\\"), true);
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
});
