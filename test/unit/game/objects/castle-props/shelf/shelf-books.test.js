import assert from "node:assert/strict";
import { test } from "node:test";
import { Entity, StandardMaterial } from "playcanvas";
import { ShelfBooks } from "../../../../../../src/game/objects/castle-props/shelf/ShelfBooks.js";

test("a full-height top compartment receives upright books", () => {
  const shelf = new Entity("shelf");
  const models = { instantiate: () => new Entity("book") };
  const level = {
    bottom: 2.15,
    height: 0.29,
  };
  ShelfBooks.populate(models, shelf, "book.glb", () => 0.5, [level]);
  assert.equal(shelf.children.length, 10);
  for (const book of shelf.children) {
    assert.equal(book.getLocalPosition().y, level.bottom);
    assert.equal(book.getLocalEulerAngles().z, 0);
    assert.ok(book.getLocalScale().y * 0.26 <= level.height);
  }
  shelf.destroy();
});

test("reusable books remain supported, fit every shelf and isolate cover colors", () => {
  const original = new StandardMaterial();
  original.name = "Book leather";
  const fixed = new StandardMaterial();
  fixed.name = "Book parchment and brass";
  const signatures = [];
  for (const seed of [42, 42, 43]) {
    let state = seed;
    const shelf = new Entity("shelf");
    for (const name of ["Leather bound book", "Book spine brass"]) {
      shelf.addChild(new Entity(name));
    }
    const models = {
      instantiate: () => {
        const book = new Entity("book");
        const renders = [{ meshInstances: [{ material: original }, { material: fixed }] }];
        book.findComponents = () => renders;

        return book;
      },
    };
    ShelfBooks.populate(models, shelf, "book.glb", () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

      return state / 4294967296;
    });
    assert.equal(shelf.children.length, 36);
    const materials = new Set();
    const signature = [];
    for (const [row, level] of ShelfBooks.levels.slice(0, 3).entries()) {
      let edge = -0.355;
      for (const book of shelf.children.slice(row * 10, row * 10 + 10)) {
        const point = book.getLocalPosition(), scale = book.getLocalScale();
        const width = scale.x * 0.065;
        assert.ok(Math.abs(point.x - width / 2 - edge) < 1e-6);
        edge = point.x + width / 2;
        assert.ok(edge <= 0.365);
        assert.equal(point.y, level.bottom);
        assert.ok(scale.y * 0.26 <= level.height + 1e-6);
        assert.ok(point.z - scale.z * 0.1 > -0.125);
        assert.ok(Math.abs(point.z - scale.z * 0.1 + 0.11) < 1e-6);
        assert.ok(point.z + scale.z * 0.1 < 0.17);
        const meshes = book.findComponents("render")[0].meshInstances;
        assert.notEqual(meshes[0].material, original);
        assert.equal(meshes[1].material, fixed);
        materials.add(meshes[0].material);
        signature.push([point.x, scale.x, scale.y, scale.z, meshes[0].material.diffuse.toString()]);
      }
    }
    for (let stack = 0; stack < 2; stack++) {
      let top = 1.13;
      for (const book of shelf.children.slice(30 + stack * 3, 33 + stack * 3)) {
        const point = book.getLocalPosition(), scale = book.getLocalScale();
        const thickness = scale.x * 0.065;
        assert.ok(Math.abs(point.y - thickness / 2 - top) < 1e-6);
        top = point.y + thickness / 2;
        assert.ok(top < 1.275);
        assert.ok(Math.abs(book.getLocalEulerAngles().z - 90) < 1e-5);
      }
    }
    assert.ok(materials.size > 3 && materials.size <= 6);
    assert.equal(original.diffuse.toString(), "#ffffff");
    signatures.push(signature);
    shelf.destroy();
  }
  assert.deepEqual(signatures[0], signatures[1]);
  assert.notDeepEqual(signatures[0], signatures[2]);
  original.destroy();
  fixed.destroy();
});
