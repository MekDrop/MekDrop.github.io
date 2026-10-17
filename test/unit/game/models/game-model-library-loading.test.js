import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { Asset } from "playcanvas";
import { GameModelLibrary } from "../../../../src/game/models/GameModelLibrary.js";
import { GameModelLoadError, GameModelLibraryDestroyedError } from "../../../../src/game/errors/assets/index.js";

/**
 * Test registry holds requests until a test explicitly completes them.
 */
class ModelRegistry {
  pending = new Map();
  started = [];
  removed = [];
  bitmapsReleased = 0;
  resourcesDestroyed = 0;
  _loader = {
    patch: () => {},
    clearCache: () => {},
  };

  /**
   * @param {Asset} asset
   */
  add(asset) {
    asset.registry = this;
  }
  fire() {}
  /**
   * @param {Asset} asset
   */
  remove(asset) {
    this.removed.push(asset.file.url);
  }
  /**
   * @param {Asset} asset
   */
  load(asset) {
    this.pending.set(asset.file.url, asset);
    this.started.push(asset.file.url);
  }
  /**
   * @param {string} url
   */
  succeed(url) {
    const asset = this.pending.get(url);
    this.pending.delete(url);
    asset.resource = {
      materials: [],
      textures: [{
        resource: {
          releaseImageSources: () => {
            this.bitmapsReleased++;
          },
        },
      }],
      destroy: () => {
        this.resourcesDestroyed++;
      },
    };
    asset.loaded = true;
    asset.fire("load", asset);
  }
  /**
   * @param {string} url @param {Error} cause
   */
  fail(url, cause) {
    const asset = this.pending.get(url);
    this.pending.delete(url);
    asset.fire("error", cause, asset);
  }
}

test("model decodes stay bounded across overlapping load calls and reuse loaded assets", async () => {
  const assets = new ModelRegistry();
  const library = new GameModelLibrary({
    pc: { Asset },
    app: { assets },
  });
  const urls = Array.from({ length: 12 }, (_, index) => `/model-${index}.glb`);
  const first = library.load(urls);
  const duplicate = library.load([urls[0], urls[4], urls[0]]);
  assert.equal(assets.pending.size, 4);
  while (assets.pending.size) {
    assert.ok(assets.pending.size <= 4);
    for (const url of [...assets.pending.keys()]) {
      assets.succeed(url);
    }
    await setImmediate();
  }
  await Promise.all([first, duplicate]);
  await library.load(urls);
  assert.deepEqual(assets.started, urls);
  library.destroy();
  assert.equal(assets.bitmapsReleased, urls.length);
  assert.equal(assets.resourcesDestroyed, urls.length);
});

test("progress counts unique completed models and identifies remaining work", async () => {
  const assets = new ModelRegistry();
  const library = new GameModelLibrary({
    pc: { Asset },
    app: { assets },
  });
  const updates = [];
  const loading = library.load(["/a", "/b", "/a"], (url, completed, total) => {
    updates.push({ url, completed, total });
  });
  assets.succeed("/b");
  await setImmediate();
  assert.deepEqual(updates.at(-1), { url: "/a", completed: 1, total: 2 });
  assets.succeed("/a");
  await loading;
  assert.equal(updates.at(-1).completed, 2);
  assert.equal(updates.at(-1).total, 2);
  library.destroy();
});

test("failed model loads retain the decoding cause and can be retried", async () => {
  const assets = new ModelRegistry();
  const library = new GameModelLibrary({
    pc: { Asset },
    app: { assets },
  });
  const failed = library.load(["/candle.glb"]);
  const cause = new DOMException("The ImageBitmap could not be allocated.", "InvalidStateError");
  const rejection = assert.rejects(failed, (error) => error instanceof GameModelLoadError && error.cause === cause);
  assets.fail("/candle.glb", cause);
  await rejection;
  const retry = library.load(["/candle.glb"]);
  assets.succeed("/candle.glb");
  await retry;
  assert.equal(assets.started.length, 2);
  library.destroy();
});

test("destroy cancels queued work and disposes models that finish loading late", async () => {
  const assets = new ModelRegistry();
  const library = new GameModelLibrary({
    pc: { Asset },
    app: { assets },
  });
  const loading = library.load(["/a", "/b", "/c", "/d", "/e", "/f"]);
  const rejection = assert.rejects(loading, GameModelLibraryDestroyedError);
  library.destroy();
  await rejection;
  for (const url of [...assets.pending.keys()]) {
    assets.succeed(url);
  }
  await setImmediate();
  assert.equal(assets.started.length, 4);
  assert.equal(assets.bitmapsReleased, 4);
  assert.equal(assets.resourcesDestroyed, 4);
  await assert.rejects(library.load(["/new"]), GameModelLibraryDestroyedError);
});
