import { ObjectDataCache } from "../../src/game/cache/ObjectDataCache.js";
import { mkdir, readFile, readdir, writeFile, rename, unlink } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { sourceStamp } from "./source-stamp.cjs";

/**
 * Publish one variant per file (bounded parts for large variants), then replace the manifest.
 * @param {{version:number, entries:Record<string, Record<string, import("../../src/game/cache/ObjectDataCache.js").CacheValue>>}} cache
 * @param {Set<string>} sources
 * @param {string[]} maps
 * @param {string} root
 */
export async function writeCache(cache, sources, maps, root = process.cwd()) {
  const directory = resolve(root, "src/game/cache/generated");
  const manifestPath = join(directory, "manifest.json");
  let previous = {};
  try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
    if (previous.sourceStamp === sourceStamp(root, previous.sources)) {
      const shards = [];
      for (const file of previous.files) {
        shards.push(JSON.parse(await readFile(join(directory, file), "utf8")));
      }
      for (const [family, records] of Object.entries(ObjectDataCache.decode(shards))) {
        cache.entries[family] = {
          ...records,
          ...cache.entries[family],
        };
      }
      for (const file of previous.sources) {
        sources.add(file);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  await mkdir(directory, { recursive: true });
  const files = [];
  let totalBytes = 0;
  for (const [family, entries] of Object.entries(cache.entries)) {
    const folder = join(directory, family);
    await mkdir(folder, { recursive: true });
    let records = {};
    let fragments = [];
    let bytes = 64;
    /**
     * @returns {Promise<void>}
     */
    const flush = async () => {
      if (!Object.keys(records).length && !fragments.length) {
        return;
      }
      const text = JSON.stringify({
        version: 1,
        entries: { [family]: records },
        fragments,
      }) + "\n";
      const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
      const file = `${family}/${hash}.json`;
      await writeFile(join(directory, file), text);
      files.push(file);
      totalBytes += Buffer.byteLength(text);
      records = {};
      fragments = [];
      bytes = 64;
    };
    for (const [key, value] of Object.entries(entries).sort()) {
      // Never combine unrelated variants, even when they would fit in one file.
      await flush();
      const size = Buffer.byteLength(JSON.stringify({ [key]: value }));
      if (size > 128 * 1024 - 256) {
        // Rare large layouts are split too; 8K UTF-16 characters occupy at most
        // 48K escaped JSON bytes, leaving plenty of room for shard metadata.
        const serialized = JSON.stringify(value);
        const total = Math.ceil(serialized.length / 8192);
        for (let index = 0; index < total; index++) {
          const fragment = {
            family,
            key,
            index,
            total,
            text: serialized.slice(index * 8192, (index + 1) * 8192),
          };
          const fragmentBytes = Buffer.byteLength(JSON.stringify(fragment)) + 1;
          if (bytes + fragmentBytes > 128 * 1024) {
            await flush();
          }
          fragments.push(fragment);
          bytes += fragmentBytes;
        }
        continue;
      }
      if (bytes + size > 128 * 1024) {
        await flush();
      }
      records[key] = value;
      bytes += size;
    }
    await flush();
    console.log(`${family}: ${Object.keys(entries).length} variants`);
  }
  const manifest = {
    version: 1,
    sources: [...sources].sort(),
    sourceStamp: sourceStamp(root, [...sources]),
    maps: maps.sort(),
    files: files.sort(),
  };
  await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest) + "\n");
  await rename(`${manifestPath}.tmp`, manifestPath);
  // Remove only generated JSON shards beneath this verified output directory.
  const retained = new Set(files);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name === "object-cache.json") {
        await unlink(join(directory, entry.name));
      }
      continue;
    }
    for (const file of await readdir(join(directory, entry.name))) {
      const local = `${entry.name}/${file}`;
      if (file.endsWith(".json") && !retained.has(local)) {
        await unlink(join(directory, local));
      }
    }
  }
  console.log(`Wrote ${files.length} shards under ${relative(root, directory)} (${(totalBytes / 1024).toFixed(1)} KiB total).`);
}
