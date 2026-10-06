import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandObjectRoots } from "../../../../../src/game/objects/shared/IslandObjectRoots.js";
import { InvalidWoodenFloorAreaError } from "../../../../../src/game/errors/wooden-floor/index.js";

let support;
const source = readFileSync(new URL("../../../../../src/game/objects/wooden-floor/WoodenFloor.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "");
const WoodenFloor = new Function("IslandObjectRoots", "addGeneratedVoxelPhysics", "InvalidWoodenFloorAreaError",
  `const floorUrl = "wood"; ${source.replace("export class", "class")} return WoodenFloor;`)(
  IslandObjectRoots, (options) => { support = options.voxels[0]; }, InvalidWoodenFloorAreaError);

it("fills reversed rectangle corners with timber ending at the requested walking height", () => {
  const definition = { id: "room", object: "WoodenFloor", from: { x: 7, y: 3, z: 9 }, to: { x: 1, y: 3, z: 2 } };
  const floor = new WoodenFloor({ pc, definition, modelLibrary: { instantiate: () => new pc.Entity() } });
  const panel = floor.visualRoots[0];
  assert.deepEqual(panel.getLocalPosition().toArray(), [4, 2.94, 5.5]);
  assert.deepEqual(panel.getLocalScale().toArray(), [6, 1, 7]);
  assert.equal(floor.definition, definition);
  assert.deepEqual(support, { x: 4, y: 2.97, z: 5.5, width: 6, height: 0.06, depth: 7 });
  assert.ok(panel.tags.has("map-object", "WoodenFloor"));
  floor.destroy();
});

it("rejects empty, non-finite, and sloping areas", () => {
  for (const to of [{ x: 0, y: 1, z: 2 }, { x: 2, y: 2, z: 2 }, { x: NaN, y: 1, z: 2 }]) {
    assert.throws(() => new WoodenFloor({ pc, definition: { id: "invalid", from: { x: 0, y: 1, z: 0 }, to } }), InvalidWoodenFloorAreaError);
  }
});

it("keeps compressed parquet clear of its backing without sinking timber into masonry", () => {
  const panel = new pc.Entity();
  const backing = new pc.Entity("Tile backing");
  panel.addChild(backing);
  WoodenFloor.createPanel({ instantiate: () => panel }, true);
  const buffer = readFileSync(new URL("../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const node = gltf.nodes.find(node => node.name === "Tile backing");
  const bounds = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
  const top = 0.001 + (backing.getLocalPosition().y + bounds.max[1] * backing.getLocalScale().y) * 0.05;
  const bottom = 0.001 + (backing.getLocalPosition().y + bounds.min[1] * backing.getLocalScale().y) * 0.05;
  assert.ok(0.004 - top > 0.002, "parquet and backing have more than 2 mm of depth separation");
  assert.ok(bottom > 0.001, "backing remains above the masonry surface");
});
