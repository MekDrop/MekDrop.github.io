import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { Asset } from "playcanvas";
import { GameAudioLibrary } from "../../../../src/game/audio/GameAudioLibrary.js";
import { GameTextureLibrary } from "../../../../src/game/textures/GameTextureLibrary.js";
import { woodTexture } from "../../../../src/game/textures/shared-textures.js";
import { GameAssetLoadError, GameAssetUnavailableError, GameAssetLibraryDestroyedError } from "../../../../src/game/errors/assets/index.js";

class AssetRegistry {
  pending = new Map();
  started = [];
  destroyed = 0;
  _loader = { clearCache: () => {} };
  /**
   * @param {Asset} asset
   */
  add(asset) {
    asset.registry = this;
  }
  fire() {}
  remove() {}
  /**
   * @param {Asset} asset
   */
  load(asset) {
    this.pending.set(asset.id, asset);
    this.started.push(asset);
  }
  /**
   * @param {Asset} asset
   */
  succeed(asset) {
    this.pending.delete(asset.id);
    asset.resource = { destroy: () => this.destroyed++ };
    asset.loaded = true;
    asset.fire("load", asset);
  }
}

for (const Library of [GameAudioLibrary, GameTextureLibrary]) {
  test(`${Library.name} shares concurrent loads, bounds work, and reports completed resources`, async () => {
    const assets = new AssetRegistry();
    const library = new Library({
      pc: { Asset },
      app: { assets },
    });
    const urls = Array.from({ length: 7 }, (_, index) => `/asset-${index}`);
    const progress = [];
    assert.throws(() => library.get(urls[0]), GameAssetUnavailableError);
    const loading = library.load([...urls, urls[0]], (url, completed, total) => progress.push({
      url,
      completed,
      total,
    }));
    const duplicate = library.load([urls[0]]);
    assert.equal(assets.pending.size, 4);
    while (assets.pending.size) {
      assert.ok(assets.pending.size <= 4);
      for (const asset of [...assets.pending.values()]) {
        assets.succeed(asset);
      }
      await setImmediate();
    }
    await Promise.all([loading, duplicate]);
    await library.load(urls);
    assert.equal(assets.started.length, urls.length);
    assert.equal(progress.at(-1).completed, urls.length);
    assert.equal(progress.at(-1).total, urls.length);
    library.destroy();
    assert.equal(assets.destroyed, urls.length);
  });

  test(`${Library.name} retries failures and releases resources that finish after destruction`, async () => {
    const assets = new AssetRegistry();
    const library = new Library({
      pc: { Asset },
      app: { assets },
    });
    const failed = library.load(["/broken"]);
    const rejection = assert.rejects(failed, GameAssetLoadError);
    const asset = assets.started[0];
    assets.pending.delete(asset.id);
    asset.fire("error", "Decode failed");
    await rejection;
    const retry = library.load(["/broken"]);
    assets.succeed(assets.started.at(-1));
    await retry;
    const pending = library.load(["/late"]);
    const cancelled = assert.rejects(pending, GameAssetLibraryDestroyedError);
    const late = assets.started.at(-1);
    library.destroy();
    await cancelled;
    assets.succeed(late);
    assert.equal(assets.destroyed, 2);
    await assert.rejects(library.load(["/after-destroy"]), GameAssetLibraryDestroyedError);
  });
}

test("texture names preserve separate sampler resources for one source image", async () => {
  const assets = new AssetRegistry();
  const textures = new GameTextureLibrary({
    pc: { Asset },
    app: { assets },
  });
  const loading = textures.loadNamed({
    grass: "/grass.png",
    garden: "/grass.png",
  });
  for (const asset of assets.pending.values()) {
    assets.succeed(asset);
  }
  await loading;
  assert.notEqual(textures.get("/grass.png", "grass"), textures.get("/grass.png", "garden"));
  assert.equal(textures.get("/grass.png", "grass").name, "grass");
  textures.destroy();
});

test("castle wood and model images share one in-flight asset and texture", async () => {
  const assets = new AssetRegistry();
  const textures = new GameTextureLibrary({
    pc: { Asset },
    app: { assets },
  });
  const named = textures.loadNamed({ castleDoor: woodTexture.url });
  const model = new Promise((resolve, reject) => {
    textures.processImage({ name: "timber-grain" }, (error, asset) => error ? reject(error) : resolve(asset));
  });
  assert.equal(assets.started.length, 1);
  assets.succeed(assets.started[0]);
  await named;
  assert.equal(await model, textures.get(woodTexture.url, "castleDoor"));
  textures.destroy();
});
