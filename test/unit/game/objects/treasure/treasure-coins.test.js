import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith(".glb?url")) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { TreasureCoins } = await import("../../../../../src/game/objects/treasure/TreasureCoins.js");
hooks.deregister();

const fixture = () => {
  const parent = new pc.Entity("Field");
  const entities = [];
  const materials = [];
  const rewards = [];
  const coins = new TreasureCoins(pc, {
    instantiate: () => {
      const entity = new pc.Entity();
      const mesh = { material: null };
      entity.findComponents = () => [{ meshInstances: [mesh] }];
      entities.push(entity);
      materials.push(mesh);

      return entity;
    },
  }, parent, (type, amount) => rewards.push([type, amount]));

  return {
    coins,
    parent,
    entities,
    materials,
    rewards,
  };
};

it("defers rewards until the frame after arrival and follows the moving hero", () => {
  const { coins, entities, rewards, parent } = fixture();
  coins.spawn("site", ["gold"], new pc.Vec3(2, 3, 4));
  const entity = entities[0];
  assert.equal(entity.parent, parent);
  assert.ok(entity.getLocalPosition().equals(new pc.Vec3(2, 3.48, 4)));
  coins.applyHeroPosition(new pc.Vec3(5, 6, 7));
  assert.deepEqual(coins.update(0.72), []);
  coins.applyHeroPosition(new pc.Vec3(-2, 8, 10));
  assert.deepEqual(coins.update(0.68), []);
  assert.ok(entity.getLocalPosition().equals(new pc.Vec3(-2, 9.05, 10)));
  assert.deepEqual(rewards, [], "arrival alone does not credit the wallet");
  assert.deepEqual(coins.update(0), ["site"]);
  assert.deepEqual(rewards, [["gold", 1]]);
  assert.equal(entity.parent, null);
  assert.deepEqual(coins.update(1), []);
  assert.deepEqual(rewards, [["gold", 1]], "arrived coins reward exactly once");
  coins.destroy();
  parent.destroy();
});

it("waits for a hero and reports each independent batch only after its final coin", () => {
  const { coins, entities, rewards, parent } = fixture();
  coins.spawn("first", ["gold", "silver", "copper"], new pc.Vec3());
  coins.spawn("second", ["copper"], new pc.Vec3(3, 0, 0));
  coins.spawn("empty", [], new pc.Vec3());
  assert.deepEqual(coins.update(10), []);
  assert.deepEqual(rewards, []);
  assert.equal(entities.length, 4);
  coins.applyHeroPosition(new pc.Vec3(0, 0, 1));
  coins.update(0);
  coins.update(0.68);
  assert.deepEqual(coins.update(0), ["second", "first"]);
  assert.deepEqual(rewards, [["copper", 1], ["copper", 1], ["silver", 1], ["gold", 1]]);
  assert.deepEqual(coins.update(10), []);
  coins.destroy();
  parent.destroy();
});

it("owns shared coin materials and destroys active flights without rewarding them", () => {
  const { coins, parent, entities, materials, rewards } = fixture();
  const sibling = new pc.Entity("Excavation");
  parent.addChild(sibling);
  coins.spawn("site", ["gold", "gold", "silver", "copper"], new pc.Vec3());
  assert.equal(materials[0].material, materials[1].material);
  assert.equal(materials[0].material.metalness, 0.82);
  assert.equal(materials[0].material.gloss, 0.7);
  const destroyed = [];
  for (const material of new Set(materials.map((mesh) => mesh.material))) {
    const destroy = material.destroy.bind(material);
    material.destroy = () => {
      destroyed.push(material);
      destroy();
    };
  }
  coins.applyHeroPosition(new pc.Vec3());
  coins.update(0.8);
  coins.destroy();
  coins.destroy();
  assert.equal(destroyed.length, 3, "shared materials are disposed once");
  assert.ok(entities.every((entity) => entity.parent === null));
  assert.equal(sibling.parent, parent, "the field root and its other children are borrowed");
  assert.deepEqual(coins.update(10), []);
  assert.deepEqual(rewards, []);
  parent.destroy();
});
it("keeps a staggered batch active until its last coin rewards", () => {
  const { coins, rewards, parent } = fixture();
  coins.spawn("site", ["gold", "silver"], new pc.Vec3());
  coins.applyHeroPosition(new pc.Vec3());
  coins.update(0.72);
  coins.update(0.05);
  coins.update(0.64);
  assert.deepEqual(coins.update(0), []);
  assert.deepEqual(rewards, [["gold", 1]]);
  assert.deepEqual(coins.update(0.06), []);
  assert.deepEqual(coins.update(0), ["site"]);
  assert.deepEqual(rewards, [["gold", 1], ["silver", 1]]);
  coins.destroy();
  parent.destroy();
});
