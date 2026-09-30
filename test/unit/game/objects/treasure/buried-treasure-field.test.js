import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import * as pc from "playcanvas";
import { GameMapLoader } from "../../../../../src/game/GameMapLoader.js";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".glb?url")) {
      return { shortCircuit: true, url: `data:text/javascript,export default ${JSON.stringify(specifier)}` };
    }
    return nextResolve(specifier, context);
  },
});
const { BuriedTreasureField } = await import("../../../../../src/game/objects/treasure/BuriedTreasureField.js");
hooks.deregister();

it("reveals the already instantiated chest and spawns its stored contents without rerolling", () => {
  const mapData = GameMapLoader.load({ cols: 1, rows: 1, grid: [[1]], heightmap: [[2]], objects: [] }, () => 0.1);
  mapData.islandConnectorData = { nearIsland: ["0,0"], farIsland: [] };
  const cube = mapData.objects.find((item) => item.buriedTreasure);
  cube.buriedTreasure.contents = ["gold", "silver", "copper"];
  let update;
  const models = [];
  const modelLibrary = {
    instantiate(url) {
      const entity = new pc.Entity(url);
      // Animation playback normally needs a graphics application; retain real transforms.
      entity.addComponent = () => {
        entity.anim = { addAnimationState() {}, baseLayer: { play() {} } };
      };
      models.push({ url, entity });
      return entity;
    },
    getAnimationTracks() { return new Map([["Open", { duration: 1 }], ["open", { duration: 1 }]]); },
  };
  const field = new BuriedTreasureField({ pc, mapData, modelLibrary,
    app: { on(event, callback) { update = callback; return { off() {} }; } },
  });
  // Mirror the live application root for hierarchy-enabled checks.
  const root = new pc.GraphNode();
  root._enabledInHierarchy = true;
  root.addChild(field.entity);
  const chest = models.find(({ url }) => url.includes("treasure-chest")).entity;
  assert.equal(chest.parent.parent, field.entity);
  assert.ok(chest.getLocalPosition().y < mapData.heightmap[0][0]);
  assert.equal(chest.enabled, false, "buried chests do not render or animate");
  const target = { kind: "dig", id: "0:0", col: 0, row: 0, x: 0, y: 2, z: 0 };
  field.dig(target);
  assert.equal(chest.enabled, true, "digging exposes the existing chest");
  const hole = models.find(({ url }) => url.includes("/hole.glb")).entity;
  const holeY = hole.getPosition().y;
  field.setIslandOffsets(0.2, -0.1);
  assert.ok(Math.abs(hole.getPosition().y - holeY - 0.2) < 1e-6);
  assert.equal(hole.parent, chest.parent);
  field.dig(target);
  for (let frame = 0; frame < 25; frame += 1) { update(0.1); }
  assert.equal(field.canOpen(target.id), true);
  assert.equal(models.filter(({ url }) => url.includes("treasure-chest")).length, 1);
  field.open(target);
  for (let frame = 0; frame < 20; frame += 1) { update(0.1); }
  assert.deepEqual(models.filter(({ url }) => url.includes("/coin.glb")).map(({ entity }) => entity.name),
    ["gold treasure coin", "silver treasure coin", "copper treasure coin"]);
});
