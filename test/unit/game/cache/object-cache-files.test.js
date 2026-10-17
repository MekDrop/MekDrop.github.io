import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, stat, rm, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { writeCache } from "../../../../scripts/object-cache/write-cache.mjs";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";

const scratch = resolve(fileURLToPath(new URL("../../../../tmp/", import.meta.url)));
await mkdir(scratch, { recursive: true });
const require = createRequire(import.meta.url);
const plugin = require("../../../../scripts/object-cache/vite-plugin.cjs");

test("the installed Vite loads a clean checkout without generated cache files", async () => {
  const root = await mkdtemp(join(scratch, "object-cache-empty-"));
  const { createServer } = await import("vite");
  let server;
  try {
    await mkdir(join(root, "src/game/cache"), { recursive: true });
    await copyFile(new URL("../../../../src/game/cache/ObjectCacheFiles.js", import.meta.url),
      join(root, "src/game/cache/ObjectCacheFiles.js"));
    server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      optimizeDeps: { disabled: true },
      server: { middlewareMode: "ssr" },
    });
    const transformed = await server.transformRequest("/src/game/cache/ObjectCacheFiles.js");
    const module = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);
    assert.deepEqual(module.default, {});
  } finally {
    await server?.close();
    assert.equal(dirname(root), scratch);
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  }
});

test("files contain one variant, stay bounded, reassemble large variants, and reject stale sources", async () => {
  const root = await mkdtemp(join(scratch, "object-cache-test-"));
  try {
    await writeFile(join(root, "generator.js"), "original");
    const entries = {
      books: {
        large: Array.from({ length: 10000 }, (_, index) => ({
          index,
          text: "one book on a shelf",
        })),
        small: [1, 2, 3],
        another: [4, 5, 6],
      },
      roofs: { roof: { height: 1 } },
    };
    await writeCache({
      version: 1,
      entries,
    }, new Set(["generator.js"]), [], root);
    const directory = join(root, "src/game/cache/generated");
    const metadata = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    const shards = [];
    for (const file of metadata.files) {
      assert.match(file, /^(books|roofs)\/[a-f\d]+\.json$/);
      const path = join(directory, file);
      assert.ok((await stat(path)).size <= 128 * 1024, file);
      const shard = JSON.parse(await readFile(path, "utf8"));
      const variants = new Set([
        ...Object.entries(shard.entries).flatMap(([family, records]) => Object.keys(records).map((key) => `${family}/${key}`)),
        ...shard.fragments.map(({ family, key }) => `${family}/${key}`),
      ]);
      assert.equal(variants.size, 1, file);
      shards.push(shard);
    }
    assert.deepEqual(ObjectDataCache.decode(shards.reverse()), entries);
    assert.equal(shards.filter((shard) => shard.entries.books?.small).length, 1);
    assert.equal(shards.filter((shard) => shard.entries.books?.another).length, 1);
    const missingPart = shards.findIndex((shard) => shard.fragments.some((fragment) => fragment.key === "large"));
    const partial = ObjectDataCache.decode(shards.filter((_, index) => index !== missingPart));
    assert.equal(partial.books?.large, undefined);
    const warnings = [];
    const context = {
      addWatchFile: () => {},
      warn: (message) => warnings.push(message),
    };
    const id = join(directory, metadata.files[0]).replaceAll("\\", "/");
    assert.deepEqual(JSON.parse(plugin(root).load.call(context, id)),
      JSON.parse(await readFile(id, "utf8")));
    await writeFile(join(root, "generator.js"), "changed");
    assert.deepEqual(JSON.parse(plugin(root).load.call(context, id)).entries, {});
    assert.equal(warnings.length, 1);
  } finally {
    // This directory was created by this test, immediately below the project scratch directory.
    assert.equal(dirname(root), scratch);
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  }
});
