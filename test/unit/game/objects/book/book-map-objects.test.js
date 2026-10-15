import assert from "node:assert/strict";
import { test } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { BookMapObjects } from "../../../../../src/game/objects/book/BookMapObjects.js";
import { BookshelfBooks } from "../../../../../src/game/objects/bookshelf/BookshelfBooks.js";
import { BookshelfLayout } from "../../../../../src/game/objects/bookshelf/BookshelfLayout.js";

test("publishes stable independent books, preserves legacy reading placements, and replaces stale contents", () => {
  const shelf = { id: "library-shelf", object: "Bookshelf", from: { x: 0, y: 2, z: 0 },
    to: { x: 0.935, y: 2, z: 0 }, height: 1.8, tile: { col: 2, row: 3 }, sourceCastleId: "castle" };
  const map = { objects: [shelf, ...["Closed", "Open", "Terrace"].map((name, index) => ({
    id: `reading-${index}`, object: `${name}ReadingBook`, position: { x: index, y: 3, z: 1 }, scale: 0.7,
  }))] };
  BookMapObjects.prepareMap(map);
  const books = map.objects.filter(item => item.sourceShelfId);
  assert.equal(books.length, 50);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
  assert.ok(books.every(book => book.object === "Book" && book.tile === shelf.tile && book.sourceCastleId === "castle"));
  assert.deepEqual(map.objects.slice(1, 4).map(item => item.isOpen), [false, true, true]);
  assert.equal(map.objects[3].style, "classic");
  assert.ok(map.objects.every(item => item.object !== "Book" || !Object.hasOwn(item, "variant")));
  assert.ok(books.every(book => book.isOpen === false && book.pose === "upright"));
  assert.deepEqual(map.objects[2].position, { x: 1, y: 3, z: 1 });
  assert.equal(map.objects[2].scale, 0.7);
  const snapshot = structuredClone(map.objects);
  BookMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, snapshot);
  shelf.height = 0.9;
  BookMapObjects.prepareMap(map);
  assert.equal(map.objects.filter(item => item.sourceShelfId).length, 20);
  map.objects = map.objects.filter(item => item !== shelf);
  BookMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 3, "removed cabinets leave no orphan volumes");
  const empty = { objects: [{ ...shelf, books: false, booksAsObjects: false }] };
  BookMapObjects.prepareMap(empty);
  assert.equal(empty.objects.length, 1);
});

test("world-space book transforms match the former cabinet hierarchy on both axes and all facings", () => {
  for (const alongX of [true, false]) {
    for (const facing of [1, -1]) {
      // A low shelf exercises stacked books and swapping the scaled axis after tipping.
      for (const height of [0.45, 1.8]) {
        const shelf = { id: "transform-shelf", object: "Bookshelf", seed: 42, facing, height,
          from: { x: 4, y: 2, z: -3 }, to: { x: alongX ? 4.9 : 4, y: 2, z: alongX ? -3 : -2.1 } };
        const bounds = BookshelfLayout.bounds(shelf);
        let state = 2166136261;
        for (const character of "42") { state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0; }
        const random = () => {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return state / 4294967296;
        };
        const rows = Math.max(1, Math.round((height - 0.0775) / 0.35));
        const spacing = (height - 0.0775) / rows;
        const local = BookshelfBooks.layout(random, Array.from({ length: rows }, (_, row) => ({
          bottom: 0.0775 + row * spacing, height: spacing - 0.055,
        })));
        const published = BookMapObjects.forShelf(shelf);
        const cabinet = new Entity("cabinet");
        const front = facing === -1 ? 0.01 : -0.01;
        cabinet.setLocalPosition(bounds.x + (alongX ? 0 : front), 2, bounds.z + (alongX ? front : 0));
        cabinet.setLocalScale(bounds.length / 0.85, 1, 1);
        cabinet.setLocalEulerAngles(0, bounds.rotation, 0);
        for (const [index, source] of local.entries()) {
          const previous = new Entity("previous book");
          cabinet.addChild(previous);
          previous.setLocalPosition(source.position.x, source.position.y, source.position.z);
          previous.setLocalEulerAngles(0, 0, source.tilt.z);
          previous.setLocalScale(source.stretch.x, source.stretch.y, source.stretch.z);
          const next = published[index];
          const root = new Entity("independent book");
          root.setLocalPosition(next.position.x, next.position.y, next.position.z);
          root.setLocalEulerAngles(0, next.rotation, next.tilt.z);
          root.setLocalScale(next.stretch.x, next.stretch.y, next.stretch.z);
          for (const point of [new Vec3(), new Vec3(0.0325, 0.26, 0.1), new Vec3(-0.0325, 0, -0.1)]) {
            const oldPoint = previous.getWorldTransform().transformPoint(point);
            const newPoint = root.getWorldTransform().transformPoint(point);
            assert.ok(oldPoint.distance(newPoint) < 1e-5, `support and footprint differ: ${alongX}, ${facing}, ${height}`);
          }
          root.destroy();
        }
        cabinet.destroy();
      }
    }
  }
});
