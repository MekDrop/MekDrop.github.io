import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { BridgeGelLoads } from "../../../../../src/game/objects/path/BridgeGelLoads.js";
import { SceneObjectRegistry } from "../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

const bridge = {
  span: {
    start: 3,
    end: 7,
    horizontal: true,
  },
  stationPosition: (station) => new Vec3(station - 3, 2, 0),
};

it("combines hero and live enemy loads once per identity and caches walker discovery", () => {
  const registry = new SceneObjectRegistry();
  const hero = {
    position: new Vec3(1, 2, 0),
    grounded: true,
  };
  const enemy = {
    position: new Vec3(3, 2, 0.3),
    grounded: true,
    alive: true,
  };
  let terrainReads = 0;
  registry.add("terrain", {
    get grounded() {
      terrainReads++;

      return undefined;
    },
  });
  registry.setOne("hero", hero);
  registry.add("enemy", enemy);
  registry.add("alternate-enemy-role", enemy);
  const reaction = new BridgeGelLoads();
  reaction.update(0, registry, bridge);
  const settled = reaction.update(1, registry, bridge);
  assert.equal(settled.get(4).compression, 0.7);
  assert.equal(settled.get(6).compression, 0.7);
  assert.equal(terrainReads, 1);
  enemy.position.x = 1;
  assert.equal(reaction.update(1, registry, bridge).get(4).compression, 1);
  assert.equal(terrainReads, 1);
});

it("excludes carried, airborne and dead enemies and discovers new registry members", () => {
  const registry = new SceneObjectRegistry();
  const reaction = new BridgeGelLoads();
  assert.equal(reaction.update(0, registry, bridge).size, 0);
  const enemy = {
    position: new Vec3(2, 2, 0),
    grounded: true,
    alive: true,
  };
  registry.add("enemy", enemy);
  assert.ok(reaction.update(0, registry, bridge).get(5).compression > 0);
  enemy.carrier = {};
  reaction.update(0, registry, bridge);
  assert.equal(reaction.update(1, registry, bridge).size, 0);
  enemy.carrier = null;
  enemy.airborne = true;
  assert.equal(reaction.update(1, registry, bridge).size, 0);
  enemy.airborne = false;
  enemy.alive = false;
  assert.equal(reaction.update(1, registry, bridge).size, 0);
  enemy.alive = true;
  assert.ok(reaction.update(0, registry, bridge).get(5).compression > 0);
});
