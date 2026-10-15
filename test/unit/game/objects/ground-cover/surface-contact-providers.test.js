import assert from "node:assert/strict";
import { it } from "node:test";
import { SceneObjectRegistry } from "../../../../../src/game/rendering/scene/SceneObjectRegistry.js";
import { SurfaceContactProviders } from "../../../../../src/game/objects/ground-cover/SurfaceContactProviders.js";

it("avoids repeated scene scans while retaining live contacts and detecting replacements", () => {
  const objects = new SceneObjectRegistry();
  let scans = 0;
  const iterate = objects[Symbol.iterator].bind(objects);
  objects[Symbol.iterator] = () => { scans++;

 return iterate(); };
  for (let index = 0; index < 7000; index++) objects.add("terrain", {});
  let x = 1;
  const provider = {
    get grassSurfaceContacts() { return [{
      x,
      y: 0,
      z: 0,
      radius: 1,
    }]; },
  };
  objects.setOne("provider", provider);
  let extra = provider;
  const cache = new SurfaceContactProviders(objects, () => [extra]);
  for (let frame = 0; frame < 120; frame++) {
    x = frame;
    assert.deepEqual(cache.contacts, [{
      x,
      y: 0,
      z: 0,
      radius: 1,
    }]);
  }
  assert.equal(scans, 1);
  const replacement = {
    grassSurfaceContacts: [{
      x: 999,
      y: 0,
      z: 0,
      radius: 1,
    }],
  };
  extra = replacement;
  objects.setOne("provider", replacement);
  assert.deepEqual(cache.contacts, replacement.grassSurfaceContacts);
  assert.equal(scans, 2);
  extra = null;
  objects.destroyType("provider");
  assert.deepEqual(cache.contacts, []);
  assert.equal(scans, 3);
  objects.clear();
  assert.deepEqual(cache.contacts, []);
  assert.equal(scans, 4);
});
