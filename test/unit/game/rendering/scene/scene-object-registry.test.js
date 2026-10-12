import assert from "node:assert/strict";
import { it } from "node:test";
import { SCENE_OBJECT_TYPE } from "../../../../../src/game/enum/SceneObjectType.js";
import { SceneObjectRegistry } from "../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

it("stores singleton objects under their singular type key", () => {
  const registry = new SceneObjectRegistry();
  const hero = { name: "hero" };

  const key = registry.setOne(SCENE_OBJECT_TYPE.HERO, hero);

  assert.equal(key, "hero");
  assert.equal(registry.get("hero"), hero);
  assert.equal(registry.getOne(SCENE_OBJECT_TYPE.HERO), hero);
  assert.deepEqual(registry.getAll(SCENE_OBJECT_TYPE.HERO), [hero]);
});

it("stores collections with singular suffixed keys", () => {
  const registry = new SceneObjectRegistry();
  const firstGateway = { name: "gateway 0" };
  const secondGateway = { name: "gateway 1" };

  const firstKey = registry.add(SCENE_OBJECT_TYPE.GATEWAY, firstGateway);
  const secondKey = registry.add(SCENE_OBJECT_TYPE.GATEWAY, secondGateway);

  assert.equal(firstKey, "gateway_0");
  assert.equal(secondKey, "gateway_1");
  assert.equal(registry.get("gateway_0"), firstGateway);
  assert.equal(registry.get("gateway_1"), secondGateway);
  assert.equal(registry.getFirst(SCENE_OBJECT_TYPE.GATEWAY), firstGateway);
  assert.deepEqual(registry.getAll(SCENE_OBJECT_TYPE.GATEWAY), [
    firstGateway,
    secondGateway,
  ]);
});

it("destroys and forgets every object for a type", () => {
  const registry = new SceneObjectRegistry();
  const destroyed = [];
  registry.add(SCENE_OBJECT_TYPE.CASTLE, {
    destroy: () => destroyed.push("castle_0"),
  });
  registry.add(SCENE_OBJECT_TYPE.CASTLE, {
    destroy: () => destroyed.push("castle_1"),
  });

  registry.destroyType(SCENE_OBJECT_TYPE.CASTLE);

  assert.deepEqual(destroyed, ["castle_0", "castle_1"]);
  assert.deepEqual(registry.getAll(SCENE_OBJECT_TYPE.CASTLE), []);
  assert.equal(registry.get("castle_0"), null);
});

it("refreshes class lookups after creation, replacement, destruction, and clearing", () => {
  class Service { destroy() {} onFrame() {} }
  const registry = new SceneObjectRegistry();
  assert.equal(registry.getFirstByClass(Service.name), null);
  const first = new Service();
  registry.add(SCENE_OBJECT_TYPE.MAP_OBJECT, first);
  assert.equal(registry.getFirstByClass(Service.name), first);
  assert.deepEqual(registry.getWithMethod("onFrame"), [first]);
  const second = new Service();
  registry.setOne(SCENE_OBJECT_TYPE.HERO, second);
  registry.destroyType(SCENE_OBJECT_TYPE.MAP_OBJECT);
  assert.equal(registry.getFirstByClass(Service.name), second);
  assert.deepEqual(registry.getWithMethod("onFrame"), [second]);
  const replacement = new Service();
  registry.setOne(SCENE_OBJECT_TYPE.HERO, replacement);
  assert.equal(registry.getFirstByClass(Service.name), replacement);
  registry.clear();
  assert.equal(registry.getFirstByClass(Service.name), null);
  assert.deepEqual(registry.getWithMethod("onFrame"), []);
});
