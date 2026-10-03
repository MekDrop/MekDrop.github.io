import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandObjectRoots } from "../../../../../src/game/objects/shared/IslandObjectRoots.js";

const source = readFileSync(new URL("../../../../../src/game/objects/flag/Flag.js", import.meta.url), "utf8")
  .replace(/^import[^\n]*\n/gm, "").replace("export class Flag", "class Flag");
class Physics {
  createCloth() { return {}; }
  endPointer() {}
  destroy() {}
}
const Flag = new Function("IslandObjectRoots", "AmmoClothPhysics", `const authoredModelUrl = "pole", finialModelUrl = "finial", clothModelUrl = "cloth"; ${source}; return Flag;`)(IslandObjectRoots, Physics);

it("migrates castle flags once, preserves overrides, and refreshes a changed seed", () => {
  const castle = { id: "castle", object: "Castle", seed: 1, tile: { col: 2, row: 3 },
    buildPlan: { geometry: { decorations: { flags: [{ x: 2, y: 4, z: 6, width: 2, height: 1, poleHeight: 3, yaw: 90 }] } } } };
  const standalone = { id: "custom", object: "Flag", position: { x: 8, y: 0, z: 8 } };
  const map = { objects: [castle, standalone] };
  Flag.prepareMap(map);
  assert.equal(map.objects.length, 3);
  const flag = map.objects[2];
  assert.deepEqual(flag.position, { x: 2, y: 4, z: 6 });
  assert.equal(flag.rotation, 90);
  flag.texture = "/custom.png";
  Flag.prepareMap(map);
  assert.equal(map.objects[2], flag);
  castle.seed = 2;
  castle.buildPlan.geometry.decorations.flags[0].x = 5;
  Flag.prepareMap(map);
  assert.equal(map.objects.length, 3);
  assert.equal(map.objects[2].position.x, 5);
  assert.equal(map.objects[1], standalone);
  map.objects.splice(0, 1);
  Flag.prepareMap(map);
  assert.deepEqual(map.objects, [standalone]);
});

it("owns custom texture loading, placement, dimensions, and cleanup", () => {
  const graphicsDevice = new pc.NullGraphicsDevice({ width: 1, height: 1 });
  const documentBefore = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {} }) }) };
  const mesh = { getPositions: (out) => out.push(0, -0.5, 0, 0, 0.5, 0, 1, 0.1, 0),
    getUvs: (channel, out) => out.push(0, 0, 0, 1, 1, 1), getIndices: (out) => out.push(0, 1, 2) };
  const library = { instantiate: () => {
    const entity = new pc.Entity("model");
    entity.findComponents = () => [{ meshInstances: [{ mesh }] }];
    return entity;
  } };
  class Entity extends pc.Entity {
    /**
     * @param {string} type
     * @param {{meshInstances: import("playcanvas").MeshInstance[]}} data
     */
    addComponent(type, data) { this.render = data; }
    destroy() { for (const instance of this.render?.meshInstances ?? []) instance.destroy(); delete this.render; super.destroy(); }
  }
  let loaded, removed, unsubscribed = false;
  const app = { graphicsDevice, on: () => ({ off() { unsubscribed = true; } }),
    assets: { fire() {}, _loader: { clearCache() {} }, add(asset) { asset.registry = this; }, load(asset) { loaded = asset; }, remove(asset) { removed = asset; } } };
  const definition = { id: "flag", object: "Flag", position: { x: 3, y: 2, z: 7 },
    width: 2, height: 1, poleHeight: 3, rotation: 90, texture: "/flag.png" };
  let flag;
  try {
    flag = new Flag({ pc: { ...pc, Entity }, app, modelLibrary: library, definition });
    assert.equal(loaded.file.url, "/flag.png");
    assert.deepEqual(flag.visualRoots[0].getLocalPosition().toArray(), [3, 2, 7]);
    const pole = flag.visualRoots[0].children[0];
    assert.equal(pole.getLocalScale().y, 3);
    const cloth = flag.visualRoots[0].children[2].render.meshInstances[0];
    const customTexture = new pc.Texture(graphicsDevice);
    loaded.resource = customTexture;
    loaded.fire("load", loaded);
    assert.equal(cloth.material.diffuseMap, customTexture);
    flag.destroy();
    flag = null;
    assert.equal(removed, loaded);
    assert.equal(unsubscribed, true);
  } finally {
    flag?.destroy();
    globalThis.document = documentBefore;
    graphicsDevice.destroy();
  }
});
