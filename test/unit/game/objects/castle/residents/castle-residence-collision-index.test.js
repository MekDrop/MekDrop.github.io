import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { SurfaceSpatialIndex } from "../../../../../../src/game/objects/shared/SurfaceSpatialIndex.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/castle/residents/CastleResidence.js", import.meta.url), "utf8");
const method = (signature) => {
  const start = source.indexOf(`  ${signature}`);
  const comment = source.indexOf("\n  /**", start);
  const destroy = source.indexOf("\n  destroy()", start);

  return source.slice(start, destroy > start ? Math.min(comment, destroy) : comment);
};

class Entity {
  setLocalPosition() {}
  setLocalEulerAngles() {}
  addChild() {}
}

class Layout {
  origin = {
    x: 0,
    y: 2,
    z: 0,
  };
  yaw = 0;
  placements = [];
  authoredStairs = [];
  toLocal(x, z) {
    return {
      x,
      z,
    };
  }
}

const createResidenceClass = (Index) => new Function(
  "SurfaceSpatialIndex", "CastleResidentialLayout", "addGeneratedVoxelPhysics", "castleStraightStairAssemblies", "FLOOR_STEP_CLEARANCE",
  `return class {
    #layout; #entity; #solids = []; #solidIndex = new SurfaceSpatialIndex();
    #buildPlannedFloors() { this.#buildExterior(); }
    #buildExterior() {
      for (let x = -8; x <= 8; x += 2) this.#solids.push({x, y: 0.5, z: 0, width: 1, height: 1, depth: 2});
    }
    #buildBasement() {} #furnishRooms() {} #buildStair() {} #addUpperFloorSupport() {}
    ${method("constructor(")}
    ${method("#indexSolids()")}
    ${method("blocksMovementAt(")}
    ${method("blocksCameraAt(")}
  }`,
)(Index, Layout, () => {}, () => [], 0.32);

it("indexes solids after both residence construction paths and preserves contact queries", () => {
  class LinearIndex {
    items = new Set();
    add(item) {
      this.items.add(item);
    }
    query() {
      return this.items;
    }
  }
  const Indexed = createResidenceClass(SurfaceSpatialIndex);
  const Linear = createResidenceClass(LinearIndex);
  for (const version of [1, 2]) {
    const options = {
      pc: { Entity },
      buildPlan: { metadata: { runtime: { residential: { version } } } },
    };
    const indexed = new Indexed(options);
    const linear = new Linear(options);
    assert.equal(indexed.blocksCameraAt(0, 2.5, 0, 0), true, "constructed solids must populate the index");
    assert.equal(indexed.blocksMovementAt(0, 0, 0.3, 2), true);
    for (let x = -10; x <= 10; x += 0.25) {
      for (let z = -3; z <= 3; z += 0.25) {
        for (const radius of [0, 0.3, 2, 5]) {
          assert.equal(indexed.blocksMovementAt(x, z, radius, 2), linear.blocksMovementAt(x, z, radius, 2));
          assert.equal(indexed.blocksCameraAt(x, 2.5, z, radius), linear.blocksCameraAt(x, 2.5, z, radius));
        }
      }
    }
  }
});
