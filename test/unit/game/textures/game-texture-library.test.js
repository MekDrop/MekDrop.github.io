import assert from "node:assert/strict";
import { test } from "node:test";
import { Asset } from "playcanvas";
import { GameTextureLibrary } from "../../../../src/game/textures/GameTextureLibrary.js";

test("wood loads lazily once across concurrent models and stays library-owned", async () => {
  const loaded = [];
  const removed = [];
  const registry = {
    add: (asset) => {
      asset.registry = registry;
    },
    fire: () => {},
    _loader: { clearCache: () => {} },
    load: (asset) => loaded.push(asset),
    remove: (asset) => removed.push(asset),
  };
  const wood = new GameTextureLibrary({
    pc: { Asset },
    app: { assets: registry },
  });
  wood.processImage({ name: "Stone" }, (error, asset) => {
    assert.equal(error, null);
    assert.equal(asset, undefined);
  });
  assert.equal(loaded.length, 0);
  const request = () => new Promise((resolve, reject) => {
    wood.processImage({ name: "timber-grain" }, (error, asset) => error ? reject(error) : resolve(asset));
  });
  const first = request();
  const second = request();
  assert.equal(loaded.length, 1);
  const asset = loaded[0];
  let released = 0;
  let destroyed = 0;
  asset.resource = {
    releaseImageSources: () => released++,
    destroy: () => destroyed++,
  };
  asset.loaded = true;
  asset.fire("load", asset);
  assert.equal(await first, await second);
  assert.equal(await request(), asset);
  const other = {};
  const model = { resource: { textures: [asset, other, asset] } };
  wood.detachModel(model);
  assert.deepEqual(model.resource.textures, [other]);
  assert.equal(destroyed, 0);
  wood.destroy();
  assert.equal(released, 1);
  assert.equal(destroyed, 1);
  assert.deepEqual(removed, [asset]);
});
