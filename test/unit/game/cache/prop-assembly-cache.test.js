import "../../../../scripts/object-cache/asset-hooks.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Entity } from "playcanvas";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";
import { GenerationRandom } from "../../../../src/game/generator/map/GenerationRandom.js";

const { Planter } = await import("../../../../src/game/objects/castle-props/planter/Planter.js");
const { FirewoodStack } = await import("../../../../src/game/objects/castle-props/firewood-stack/FirewoodStack.js");
const { SpareTimberBundle } = await import("../../../../src/game/objects/castle-props/spare-timber-bundle/SpareTimberBundle.js");
const original = ObjectDataCache.data;
afterEach(() => {
  ObjectDataCache.finishRecording(); ObjectDataCache.data = original;
});

/**
 * @param {typeof Planter|typeof FirewoodStack|typeof SpareTimberBundle} Type
 */
function modelFor(Type) {
  const app = { _entityIndex: {} };
  const model = new Entity(undefined, app);
  const names = Type === Planter ? ["Boxwood foliage", ...[1, 2, 3, 4].map((index) => `Boxwood foliage.${String(index).padStart(3, "0")}`)] :
    Type === FirewoodStack ? ["Cut firewood log 1", "Cut firewood log 2"] : ["Stored spare timber board 1", "Stored spare timber board 2"];
  for (const [index, name] of names.entries()) {
    const entity = new Entity(name, app);
    entity.setLocalPosition(index * 0.05, 0.3 + index * 0.1, index * 0.02);
    model.addChild(entity);
  }

  return model;
}

/**
 * @param {Entity} model
 */
function snapshot(model) {
  return model.children.map((entity) => ({
    name: entity.name,
    position: entity.getLocalPosition().toArray(),
    rotation: entity.getLocalRotation().toArray(),
    scale: entity.getLocalScale().toArray(),
  }));
}

for (const Type of [Planter, FirewoodStack, SpareTimberBundle]) {
  test(`${Type.name} disk recipes bypass RNG and reproduce independent visible/collision assemblies`, (t) => {
    const definition = {
      id: "prop-seed",
      width: 0.4,
      depth: 0.38,
      height: 0.7,
    };
    const generated = modelFor(Type);
    ObjectDataCache.beginRecording();
    Type.prototype.prepareModel.call({ definition }, generated, false);
    const expected = snapshot(generated);
    assert.ok(expected.length > 0);
    ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
    t.mock.method(GenerationRandom.prototype, "rng", () => assert.fail("generator ran on cache hit"));
    const first = modelFor(Type);
    const collision = modelFor(Type);
    Type.prototype.prepareModel.call({ definition }, first, false);
    Type.prototype.prepareModel.call({ definition }, collision, true);
    assert.deepEqual(snapshot(first), expected);
    assert.deepEqual(snapshot(collision), expected);
    first.children[0].setLocalPosition(100, 100, 100);
    assert.deepEqual(snapshot(collision), expected);
    generated.destroy(); first.destroy(); collision.destroy();
  });
}
