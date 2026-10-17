import assert from "node:assert/strict";
import { test } from "node:test";
import { BookshelfPlacementRules } from "../../../../../../src/game/generator/castle/rooms/BookshelfPlacementRules.js";
import { RoomPlacementRules } from "../../../../../../src/game/generator/castle/rooms/RoomPlacementRules.js";
import { ShelfLayout } from "../../../../../../src/game/objects/castle-props/shelf/ShelfLayout.js";

const room = {
  id: "study",
  minX: 0,
  maxX: 4,
  minZ: 0,
  maxZ: 4,
  floorY: 0,
  height: 3,
};
const wall = {
  x: 2,
  z: 4.125,
  y: 1.5,
  halfX: 2,
  halfZ: 0.125,
  halfY: 1.5,
};
const cabinet = {
  id: "books",
  roomId: room.id,
  object: "Shelf",
  x: 2,
  z: 2,
  width: 0.85,
  depth: 0.36,
  height: 1.35,
  floorY: 0,
  scale: 1,
  rotation: 0,
};

test("places bookshelves at walls before moving loose furniture out of their reading space", () => {
  const desk = {
    ...cabinet,
    id: "desk",
    object: "Table",
    z: 2.7,
    width: 1,
    depth: 0.6,
    height: 0.75,
  };
  const result = RoomPlacementRules.repair([desk, cabinet], [wall], [room]);
  const shelf = result.find(item => item.id === cabinet.id);
  const table = result.find(item => item.id === desk.id);
  const placement = BookshelfPlacementRules.placement(shelf, [wall], room);
  assert.ok(placement);
  assert.ok(Math.abs(4 - shelf.z - shelf.depth / 2 - 0.02501) < 1e-6);
  const access = placement.access;
  assert.equal(access.maxZ - access.minZ, 1);
  assert.ok(table.x + table.width / 2 <= access.minX || table.x - table.width / 2 >= access.maxX ||
    table.z + table.depth / 2 <= access.minZ || table.z - table.depth / 2 >= access.maxZ);
  assert.ok(result.every(item => !item.placementIssue));
});

test("continuous masonry supports a wider cabinet while a gap does not", () => {
  const blocks = [1.5, 2, 2.5].map(x => ({
    ...wall,
    x,
    halfX: 0.25,
  }));
  const shelf = {
    ...cabinet,
    z: 3.79499,
  };
  assert.ok(BookshelfPlacementRules.placement(shelf, blocks, room));
  assert.equal(BookshelfPlacementRules.placement(shelf, [blocks[0], blocks[2]], room), null);
});

test("reports unplaceable bookcases rather than accepting a floating cabinet", () => {
  const [item] = RoomPlacementRules.repair([cabinet], [], [room]);
  assert.equal(item.placementIssue, "No clear position in authored room");
  assert.equal(BookshelfPlacementRules.isBookcase({
    ...cabinet,
    variant: "storage",
  }), false);
});

test("book spines face the room from every cardinal wall", () => {
  for (const [from, to, expected] of [
    [{
      x: 0.2,
      z: 1,
    }, {
      x: 0.2,
      z: 2,
    }, 1],
    [{
      x: 3.8,
      z: 1,
    }, {
      x: 3.8,
      z: 2,
    }, -1],
    [{
      x: 1,
      z: 0.2,
    }, {
      x: 2,
      z: 0.2,
    }, 1],
    [{
      x: 1,
      z: 3.8,
    }, {
      x: 2,
      z: 3.8,
    }, -1],
  ]) {
    assert.equal(ShelfLayout.facingToward({
      from,
      to,
    }, {
      x: 2,
      z: 2,
    }), expected);
  }
});
