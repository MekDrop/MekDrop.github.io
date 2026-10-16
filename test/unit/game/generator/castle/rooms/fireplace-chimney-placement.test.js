import assert from "node:assert/strict";
import { test } from "node:test";
import { RoomPlacementRules } from "../../../../../../src/game/generator/castle/rooms/RoomPlacementRules.js";
import { FireplaceChimneyFootprint } from "../../../../../../src/game/objects/castle-props/fireplace/FireplaceChimneyFootprint.js";

const kitchen = {
  id: "kitchen",
  minX: 0,
  maxX: 4,
  minZ: 0,
  maxZ: 4,
  floorY: 0,
  height: 3,
};
const upper = {
  ...kitchen,
  id: "upper",
  floorY: 3,
};
const hearth = {
  id: "hearth",
  roomId: kitchen.id,
  object: "Fireplace",
  x: 2,
  z: 0.575,
  width: 1.407,
  depth: 0.815,
  scale: 1,
  floorY: 0,
  rotation: 0,
};

test("chimney reservations follow rotated and scaled courses through upper rooms", () => {
  for (const rotation of [0, 90, 180, 270]) {
    const item = {
      ...hearth,
      x: 2,
      z: 2,
      rotation,
      scale: 1.5,
    };
    const bounds = FireplaceChimneyFootprint.bounds(item, [kitchen, upper]);
    const furniture = {
      object: "Crate",
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
      width: 0.3,
      depth: 0.3,
      height: 0.5,
      scale: 1,
      floorY: 3,
    };
    assert.equal(RoomPlacementRules.accepts(furniture, upper, [item]), false);
    assert.equal(RoomPlacementRules.accepts({
      ...furniture,
      x: 3.5,
      z: 3.5,
    }, upper, [item]), true);
    assert.ok(bounds.top > upper.floorY + upper.height);
    assert.ok(Math.abs(bounds.maxX - bounds.minX - (rotation % 180 ? 0.4 : 0.58) * 1.5) < 1e-6);
  }
});

test("repair reserves the final fireplace position before upper furniture and supported details", () => {
  const table = {
    id: "table",
    roomId: upper.id,
    object: "Table",
    width: 0.6271365,
    height: 0.56465894,
    depth: 1.25,
    x: 2,
    z: 0.5,
    width: 0.7,
    depth: 0.7,
    height: 0.7,
    scale: 1,
    floorY: 3,
  };
  const bowl = {
    ...table,
    id: "bowl",
    object: "Bowl",
    supportId: table.id,
    width: 0.2,
    depth: 0.2,
    height: 0.1,
    y: 0.7,
  };
  const walls = [{
    x: 2,
    y: 1.5,
    z: 0,
    halfX: 2,
    halfY: 1.5,
    halfZ: 0.125,
  }];
  const result = RoomPlacementRules.repair([table, bowl, hearth], walls, [upper, kitchen]);
  const repairedHearth = result.find(item => item.id === hearth.id);
  const chimney = FireplaceChimneyFootprint.bounds(repairedHearth, [kitchen, upper]);
  const repairedTable = result.find(item => item.id === table.id);
  const repairedBowl = result.find(item => item.id === bowl.id);
  assert.ok(!repairedTable.placementIssue);
  assert.ok(repairedTable.x + 0.35 <= chimney.minX || repairedTable.x - 0.35 >= chimney.maxX ||
    repairedTable.z + 0.35 <= chimney.minZ || repairedTable.z - 0.35 >= chimney.maxZ);
  assert.equal(repairedTable.x, repairedBowl.x);
  assert.equal(repairedTable.z, repairedBowl.z);
});
