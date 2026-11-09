import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { SurfaceSpatialIndex } from "../../../../../../src/game/objects/shared/SurfaceSpatialIndex.js";
import { CastleWindowLayout } from "../../../../../../src/game/objects/castle/structure/CastleWindowLayout.js";
import { createCastleMasonryVoxels } from "../../../../../../src/game/objects/castle/structure/CastleMasonryPhysics.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/castle/structure/CastleMasonry.js", import.meta.url), "utf8")
  .replace(/^import.*;\r?\n/gm, "").replace("export class", "class");
const createClass = new Function("SurfaceSpatialIndex", "CastleWindowLayout", "createCastleMasonryVoxels", "addGeneratedVoxelPhysics", "stoneBlockUrl", `${source}\nreturn CastleMasonry;`);

const box = {
  x: 0,
  y: 2,
  z: 0,
  sx: 6,
  sy: 4,
  sz: 0.5,
  yaw: 0,
  material: "stone",
};
const windowCut = {
  minX: 1.5,
  maxX: 2.5,
  minY: 2,
  maxY: 3,
  minZ: -1,
  maxZ: 1,
};

/**
 * Exercise real engine transforms and real cut/voxel math; replace GPU uploads
 * and native body allocation with tracked resources at their existing boundary.
 * @param {boolean} failInitially
 */
function fixture(failInitially = false) {
  const parent = new pc.Entity("Castle");
  const batches = [];
  const physics = [];
  let fail = failInitially;
  let failPhysics = false;
  const Masonry = createClass(SurfaceSpatialIndex, CastleWindowLayout, createCastleMasonryVoxels,
    ({ parent: root, voxels }) => {
      const record = {
        root,
        voxels,
        destroyed: 0,
      };
      physics.push(record);
      root.once("destroy", () => record.destroyed++);
      const collider = new pc.Entity("native collider");
      root.addChild(collider);
      if (failPhysics) {
        throw new RangeError("injected native shape failure");
      }
    }, "masonry.glb");
  const materials = new Map([["stone", { name: "borrowed stone" }], ["trim", { name: "borrowed trim" }]]);
  const modelLibrary = {
    instantiateMergedBatch: (url, matrices, options) => {
      if (fail && options.material === materials.get("trim")) {
        throw new RangeError("injected upload failure");
      }
      const entity = new pc.Entity(options.name);
      let destroyed = 0;
      const vertexBuffer = { destroy: () => destroyed++ };
      batches.push({
        url,
        matrices,
        options,
        entity,
        get destroyed() {
          return destroyed;
        },
      });

      return {
        entity,
        vertexBuffer,
      };
    },
  };
  const boxes = [box, {
    ...box,
    y: 4.5,
    sy: 1,
    material: "trim",
  }];
  const buildPlan = {
    geometry: { boxes },
    metadata: {
      collision: {
        cameraBlocks: boxes.map((entry) => ({
          x: entry.x,
          y: entry.y,
          z: entry.z,
          halfX: entry.sx / 2,
          halfY: entry.sy / 2,
          halfZ: entry.sz / 2,
        })),
      },
    },
  };
  const windows = {
    cutBoxes: (entries) => CastleWindowLayout.subtractBoxes(entries, [windowCut]),
    windows: [{
      yaw: 0,
      position: {
        x: 2,
        y: 2,
        z: 0,
      },
      width: 1,
      height: 1,
      depth: 0.5,
    }],
  };

  return {
    parent,
    batches,
    physics,
    boxes,
    materials,
    buildPlan,
    windows,
    create: () => new Masonry({
      pc,
      parent,
      modelLibrary,
      materials,
      buildPlan,
      windows,
    }),
    set fail(value) {
      fail = value;
    },
    set failPhysics(value) {
      failPhysics = value;
    },
  };
}

/**
 * @param {number} width
 */
function doorwayCut(width) {
  return {
    minX: -width / 2,
    maxX: width / 2,
    minY: 0.025,
    maxY: 2.35,
    minZ: -0.8,
    maxZ: 0.8,
  };
}

it("keeps window reveals, glazing, render transforms and native collision in agreement", () => {
  const f = fixture();
  const original = JSON.stringify(f.buildPlan);
  const masonry = f.create();
  const expectedBoxes = f.windows.cutBoxes(f.boxes, 0.002);
  const expected = new Map();
  for (const entry of expectedBoxes) {
    const matrix = new pc.Mat4().setTRS(
      new pc.Vec3(entry.x, entry.y - entry.sy / 2, entry.z),
      new pc.Quat().setFromEulerAngles(0, entry.yaw, 0),
      new pc.Vec3(entry.sx, entry.sy, entry.sz),
    );
    const matrices = expected.get(entry.material) ?? [];
    matrices.push(...matrix.data);
    expected.set(entry.material, matrices);
  }
  assert.deepEqual(f.batches.map((batch) => batch.matrices), [...expected.values()]);
  assert.deepEqual(f.physics.at(-1).voxels, createCastleMasonryVoxels(masonry.collisionBlocks));
  const glazing = masonry.collisionBlocks.at(-1);
  assert.equal(glazing.halfZ, 0.025);
  assert.equal(glazing.z, -0.5 * 0.315);
  assert.ok([...masonry.collisionIndex.query(2, glazing.z, 0)].includes(glazing));
  assert.equal(JSON.stringify(f.buildPlan), original);
  masonry.destroy();
  masonry.destroy();
  assert.ok(f.batches.every((batch) => batch.destroyed === 1));
  assert.ok(f.physics.every((record) => record.destroyed === 1));
  assert.equal(f.parent.children.length, 0);
  assert.equal(f.materials.size, 2);
});

it("repeated widening cuts the current geometry and retires each successful generation once", () => {
  const f = fixture();
  const masonry = f.create();
  const door = {};
  const otherDoor = {};
  for (const width of [1.5, 3]) {
    assert.equal(masonry.canBreach(door, width), true);
    masonry.breach(door, width, doorwayCut(width));
    assert.equal(masonry.canBreach(door, width), false);
    assert.equal(masonry.canBreach(door, width - 0.1), false);
    assert.equal(masonry.canBreach(otherDoor, width), true);
    assert.equal(f.parent.children.length, 1);
    assert.deepEqual(f.physics.at(-1).voxels, createCastleMasonryVoxels(masonry.collisionBlocks));
    for (const block of masonry.collisionBlocks) {
      assert.equal(CastleWindowLayout.intersects(CastleWindowLayout.bounds({
        ...block,
        sx: block.halfX * 2,
        sy: block.halfY * 2,
        sz: block.halfZ * 2,
        yaw: 0,
      }), doorwayCut(width)), false);
    }
  }
  masonry.destroy();
  assert.ok(f.batches.every((batch) => batch.destroyed === 1));
  assert.ok(f.physics.every((record) => record.destroyed === 1));
});

it("rolls back a failed rebuild and permits retry without losing live buffers or collision", () => {
  const f = fixture();
  const masonry = f.create();
  const root = f.parent.children[0];
  const blocks = masonry.collisionBlocks;
  const index = masonry.collisionIndex;
  const door = {};
  f.fail = true;
  assert.throws(() => masonry.breach(door, 2, doorwayCut(2)), RangeError);
  assert.deepEqual(f.parent.children, [root]);
  assert.equal(masonry.collisionBlocks, blocks);
  assert.equal(masonry.collisionIndex, index);
  assert.equal(masonry.canBreach(door, 2), true);
  assert.equal(f.batches[0].destroyed, 0);
  assert.equal(f.batches.at(-1).destroyed, 1);
  f.fail = false;
  masonry.breach(door, 2, doorwayCut(2));
  assert.equal(masonry.canBreach(door, 2), false);
  assert.equal(f.batches[0].destroyed, 1);
  masonry.destroy();
  assert.ok(f.batches.every((batch) => batch.destroyed === 1));
  assert.ok(f.physics.every((record) => record.destroyed === 1));
});

it("cleans a failed initial build without destroying the borrowed parent or materials", () => {
  const f = fixture(true);
  assert.throws(f.create, RangeError);
  assert.equal(f.parent.children.length, 0);
  assert.equal(f.parent.name, "Castle");
  assert.equal(f.materials.size, 2);
  assert.ok(f.batches.every((batch) => batch.destroyed === 1));
  assert.ok(f.physics.every((record) => record.destroyed === 1));
});

const builderSource = readFileSync(new URL("../../../../../../src/game/objects/castle/structure/CastleEntityBuilder.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "");
const constructorStart = builderSource.indexOf("  constructor({");
const constructorEnd = builderSource.indexOf("\n  get entity()", constructorStart);
const isolatedBuilder = builderSource.slice(0, constructorStart) + `
  constructor(parent, door, masonry, app) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = parent;
    this.#animatedDoors = [door];
    this.#masonry = masonry;
    this.#cameraCollisionBlocks = masonry.collisionBlocks;
    this.#cameraCollisionIndex = masonry.collisionIndex;
  }
` + builderSource.slice(constructorEnd);

it("admits only broken owned doors and restores whole-castle batching after a failed breach", () => {
  const f = fixture();
  const masonry = f.create();
  const batches = [];
  class RenderBatch {
    constructor() {
      this.destroyed = 0;
      batches.push(this);
    }
    destroy() {
      this.destroyed++;
    }
  }
  const Builder = new Function("pc", "SurfaceSpatialIndex", "DynamicRenderBatch", `${isolatedBuilder.replace("export class", "class")}\nreturn CastleEntityBuilder;`)(pc, SurfaceSpatialIndex, RenderBatch);
  const entity = {
    getPosition: () => new pc.Vec3(),
    forward: new pc.Vec3(0, 0, -1),
    enabled: true,
  };
  const door = {
    entity,
    broken: false,
    blocksCameraAt: () => false,
  };
  const builder = new Builder(f.parent, door, masonry, {});
  builder.onSceneReady();
  assert.equal(builder.breachDoorway(door, 2, 2.2), false);
  door.broken = true;
  assert.equal(builder.breachDoorway({ ...door }, 2, 2.2), false);
  for (const invalid of [0, -1, Infinity, NaN]) {
    assert.equal(builder.breachDoorway(door, invalid, 2.2), false);
    assert.equal(builder.breachDoorway(door, 2, invalid), false);
  }
  assert.equal(batches.length, 1);
  f.fail = true;
  assert.throws(() => builder.breachDoorway(door, 2, 2.2), RangeError);
  assert.equal(entity.enabled, true);
  assert.equal(batches[0].destroyed, 1);
  assert.equal(batches.length, 2);
  f.fail = false;
  assert.equal(builder.breachDoorway(door, 2, 2.2), true);
  assert.equal(entity.enabled, false);
  assert.equal(builder.breachDoorway(door, 2, 4), false);
  assert.equal(builder.breachDoorway(door, 3, 2.2), true);
  assert.equal(batches.length, 4);
  assert.ok(batches.slice(0, -1).every((batch) => batch.destroyed === 1));
  assert.equal(builder.blocksCameraAt(0, 1, 0), false);
  masonry.destroy();
  f.parent.destroy();
});

it("releases partial native colliders and preserves the previous generation for retry", () => {
  const f = fixture();
  const masonry = f.create();
  const root = f.parent.children[0];
  const index = masonry.collisionIndex;
  f.failPhysics = true;
  assert.throws(() => masonry.breach({}, 2, doorwayCut(2)), RangeError);
  assert.deepEqual(f.parent.children, [root]);
  assert.equal(masonry.collisionIndex, index);
  assert.equal(f.physics[0].destroyed, 0);
  assert.equal(f.physics[1].destroyed, 1);
  masonry.destroy();
  assert.ok(f.physics.every((record) => record.destroyed === 1));
});
