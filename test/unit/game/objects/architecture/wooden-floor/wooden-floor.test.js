import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { everyFiniteNumber } from "../../../../../../src/game/helpers/collections.js";
import { IslandObjectRoots } from "../../../../../../src/game/objects/shared/IslandObjectRoots.js";
import { InvalidWoodenFloorAreaError } from "../../../../../../src/game/errors/wooden-floor/index.js";

let support;
const source = readFileSync(new URL("../../../../../../src/game/objects/architecture/wooden-floor/WoodenFloor.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "");
const WoodenFloor = new Function("IslandObjectRoots", "addGeneratedVoxelPhysics", "InvalidWoodenFloorAreaError", "everyFiniteNumber",
  `const floorUrl = "wood"; ${source.replace("export class", "class")} return WoodenFloor;`)(
  IslandObjectRoots, (options) => {
    support = options.voxels[0];
  }, InvalidWoodenFloorAreaError, everyFiniteNumber);

it("fills reversed rectangle corners with timber ending at the requested walking height", () => {
  const definition = {
    id: "room",
    object: "WoodenFloor",
    from: {
      x: 7,
      y: 3,
      z: 9,
    },
    to: {
      x: 1,
      y: 3,
      z: 2,
    },
  };
  const floor = new WoodenFloor({
    pc,
    definition,
    modelLibrary: { instantiate: () => new pc.Entity() },
  });
  const panel = floor.visualRoots[0];
  assert.deepEqual(panel.getLocalPosition().toArray(), [4, 2.94, 5.5]);
  assert.deepEqual(panel.getLocalScale().toArray(), [6, 1, 7]);
  assert.equal(floor.definition, definition);
  assert.deepEqual(support, {
    x: 4,
    y: 2.97,
    z: 5.5,
    width: 6,
    height: 0.06,
    depth: 7,
  });
  assert.ok(panel.tags.has("map-object", "WoodenFloor"));
  floor.destroy();
});

it("rejects empty, non-finite, and sloping areas", () => {
  for (const to of [{
    x: 0,
    y: 1,
    z: 2,
  }, {
    x: 2,
    y: 2,
    z: 2,
  }, {
    x: NaN,
    y: 1,
    z: 2,
  }]) {
    assert.throws(() => new WoodenFloor({
      pc,
      definition: {
        id: "invalid",
        from: {
          x: 0,
          y: 1,
          z: 0,
        },
        to,
      },
    }), InvalidWoodenFloorAreaError);
  }
});

it("keeps compressed parquet clear of its backing without sinking timber into masonry", () => {
  const panel = new pc.Entity();
  const backing = new pc.Entity("Tile backing");
  panel.addChild(backing);
  WoodenFloor.createPanel({ instantiate: () => panel }, true);
  const buffer = readFileSync(new URL("../../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const node = gltf.nodes.find(node => node.name === "Tile backing");
  const bounds = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
  const top = 0.001 + (backing.getLocalPosition().y + bounds.max[1] * backing.getLocalScale().y) * 0.05;
  const bottom = 0.001 + (backing.getLocalPosition().y + bounds.min[1] * backing.getLocalScale().y) * 0.05;
  assert.ok(0.004 - top > 0.002, "parquet and backing have more than 2 mm of depth separation");
  assert.ok(bottom > 0.001, "backing remains above the masonry surface");
});

it("keeps plank top seams equally narrow when a room stretches the floor panel", () => {
  const buffer = readFileSync(new URL("../../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength));
  const binary = buffer.subarray(28 + jsonLength);
  for (const [width, depth] of [[1, 1], [3.25, 3.5], [6, 7]]) {
    const root = new pc.Entity();
    const renders = [];
    for (const source of gltf.nodes.filter(node => node.name.startsWith("Oak plank"))) {
      const node = new pc.Entity(source.name);
      node.setLocalPosition(...source.translation);
      root.addChild(node);
      const accessor = gltf.accessors[gltf.meshes[source.mesh].primitives[0].attributes.POSITION];
      const view = gltf.bufferViews[accessor.bufferView];
      const vertices = [];
      for (let index = 0; index < accessor.count; index++) {
        for (let axis = 0; axis < 3; axis++) {
          vertices.push(binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * (view.byteStride ?? 12) + axis * 4));
        }
      }
      const min = new pc.Vec3(...accessor.min), max = new pc.Vec3(...accessor.max);
      const aabb = new pc.BoundingBox();
      aabb.setMinMax(min, max);
      const top = vertices.filter((value, index) => index % 3 === 1).reduce((a, b) => Math.max(a, b));
      const points = [];
      for (let index = 0; index < vertices.length; index += 3) {
        if (vertices[index + 1] >= top - 1e-5) {
          points.push({
            x: vertices[index],
            z: vertices[index + 2],
          });
        }
      }
      node.topPoints = points;
      renders.push({
        entity: node,
        meshInstances: [{
          mesh: {
            aabb,
            getPositions: output => output.push(...vertices),
          },
        }],
      });
    }
    root.findComponents = () => renders;
    WoodenFloor.createPanel({ instantiate: () => root }, false, width, depth);
    const edge = (name, axis, maximum) => {
      const node = root.findByName(name);
      const points = node.topPoints.map(point => (node.getLocalPosition()[axis] + point[axis] * node.getLocalScale()[axis]) * (axis === "x" ? width : depth));

      return maximum ? Math.max(...points) : Math.min(...points);
    };
    const endGap = edge("Oak plank row 1 section 2", "x", false) - edge("Oak plank row 1 section 1", "x", true);
    const sideGap = edge("Oak plank row 1 section 1", "z", false) - edge("Oak plank row 2 section 1", "z", true);
    assert.ok(Math.abs(endGap - 0.006) < 1e-6);
    assert.ok(Math.abs(sideGap - 0.006) < 1e-6);
  }
});
