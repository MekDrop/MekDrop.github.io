import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { IslandObjectRoots } from "../../../../../src/game/objects/shared/IslandObjectRoots.js";

class FakeEntity {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.y = 0;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  setLocalPosition(x, y) {
    this.y = y;
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeSurface {
  constructor(context) {
    this.entity = new FakeEntity(this.constructor.name);
    this.rivers = context.mapData.riverData;
    this.time = 0;
    surfaces.push(this);
  }

  build() {}

  update(deltaTime) {
    this.time += deltaTime;
  }

  destroy() {
    this.entity.destroy();
  }
}

const surfaces = [];
globalThis.__riverMotionTest = {
  RiverWater: class RiverWater extends FakeSurface {},
  RiverLava: class RiverLava extends FakeSurface {},
  IslandObjectRoots,
};
const source = readFileSync(
  new URL("../../../../../src/game/objects/water/Rivers.js", import.meta.url),
  "utf8",
).replace(/^import[^;]+;\r?\n/gm, "");
const { Rivers } = await import(`data:text/javascript,${encodeURIComponent(
  `const { RiverWater, RiverLava, IslandObjectRoots } = globalThis.__riverMotionTest;\n${source}`,
)}`);
delete globalThis.__riverMotionTest;

it("moves water and lava with their banks while advancing every surface clock", () => {
  surfaces.length = 0;
  const riverData = [
    { kind: "WATER", cells: [{ col: 1, row: 1 }] },
    { kind: "LAVA", cells: [{ col: 8, row: 1 }] },
  ];
  const rivers = new Rivers({
    pc: { Entity: FakeEntity },
    mapData: {
      riverData,
      islandConnectorData: { nearIsland: ["0,1"], farIsland: ["9,1"] },
    },
  });
  rivers.setIslandOffsets(0.06, -0.04);
  rivers.update(0.25);
  assert.equal(surfaces.length, 4);
  for (const surface of surfaces) {
    assert.equal(surface.entity.parent.y, surface.rivers[0] === riverData[0] ? 0.06 : -0.04);
    assert.equal(surface.time, 0.25);
  }
  rivers.setIslandOffsets(-0.02, 0.03);
  rivers.update(0.5);
  for (const surface of surfaces) {
    assert.equal(surface.entity.parent.y, surface.rivers[0] === riverData[0] ? -0.02 : 0.03);
    assert.equal(surface.time, 0.75);
  }
  rivers.destroy();
  assert.ok(surfaces.every(surface => surface.entity.destroyed));
});

it("keeps single-island and unassigned rivers on the shared root", () => {
  for (const islandConnectorData of [undefined, { nearIsland: ["0,0"], farIsland: ["9,9"] }]) {
    surfaces.length = 0;
    const rivers = new Rivers({
      pc: { Entity: FakeEntity },
      mapData: { islandConnectorData, riverData: [{ cells: [{ col: 4, row: 4 }] }] },
    });
    rivers.setIslandOffsets(0.06, -0.04);
    rivers.update(0.5);
    assert.equal(surfaces.length, 2);
    for (const surface of surfaces) {
      assert.equal(surface.entity.parent, rivers.entity);
      assert.equal(surface.time, 0.5);
    }
    rivers.destroy();
  }
});

