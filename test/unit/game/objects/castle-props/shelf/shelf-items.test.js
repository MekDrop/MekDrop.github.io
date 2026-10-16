import assert from "node:assert/strict";
import { it } from "node:test";
import { ShelfItems } from "../../../../../../src/game/objects/castle-props/shelf/ShelfItems.js";
import { BookMapObjects } from "../../../../../../src/game/objects/castle-props/book/BookMapObjects.js";

it("transforms supplied shelf contents, preserves book properties, and replaces stale records", () => {
  const shelf = {
    id: "supplies",
    object: "Shelf",
    variant: "storage",
    position: {
      x: 10,
      y: 3,
      z: 20,
    },
    rotation: 90,
    scale: 2,
    tile: {
      col: 1,
      row: 2,
    },
    items: [{
      id: "volume",
      object: "Book",
      position: {
        x: 0.1,
        y: 0.5,
        z: 0,
      },
      isOpen: true,
      scale: 0.4,
      rotation: 15,
    }],
  };
  const map = { objects: [shelf] };
  ShelfItems.prepareMap(map);
  BookMapObjects.prepareMap(map);
  const content = map.objects[1];
  assert.deepEqual(content.position, {
    x: 10,
    y: 4,
    z: 19.8,
  });
  assert.equal(content.scale, 0.8);
  assert.equal(content.rotation, 105);
  assert.equal(content.isOpen, true);
  assert.equal(content.sourceShelfId, shelf.id);
  const snapshot = structuredClone(map);
  ShelfItems.prepareMap(map);
  BookMapObjects.prepareMap(map);
  assert.deepEqual(map, snapshot);
  shelf.items = [];
  ShelfItems.prepareMap(map);
  BookMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, [shelf]);
});

it("supplied contents replace generated books and default poses rest on the cabinet board", () => {
  const shelf = {
    id: "cabinet",
    object: "Shelf",
    from: {
      x: 0,
      y: 2,
      z: 0,
    },
    to: {
      x: 0.935,
      y: 2,
      z: 0,
    },
    items: [{
      id: "book",
      object: "Book",
    }],
  };
  const map = { objects: [shelf] };
  ShelfItems.prepareMap(map);
  BookMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 2);
  assert.deepEqual(map.objects[1].position, {
    x: 0.4675,
    y: 2.0775,
    z: 0,
  });
});
