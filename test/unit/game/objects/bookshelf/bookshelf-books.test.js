import assert from "node:assert/strict";
import { test } from "node:test";
import { Entity } from "playcanvas";
import { BookshelfBooks } from "../../../../../src/game/objects/bookshelf/BookshelfBooks.js";

test("random book widths vary per section and row while preserving fit and spine details", () => {
  let seed = 345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sections = [];
  for (let section = 0; section < 2; section += 1) {
    const model = new Entity("shelf");
    const books = [];
    const bands = [];
    for (let row = 0; row < 3; row += 1) {
      for (let index = 0; index < 8; index += 1) {
        const book = new Entity(`Leather bound book ${row}-${index}`);
        book.setLocalPosition(-0.32 + index * 0.09, 0.21 + row * 0.35, 0.02);
        model.addChild(book);
        books.push(book);
        for (const offset of [-0.08, 0.08]) {
          const band = new Entity(`Book spine brass ${row}-${index}-${offset}`);
          band.setLocalPosition(book.getLocalPosition().x, book.getLocalPosition().y + offset, 0.135);
          model.addChild(band);
          bands.push({ book, band });
        }
      }
    }
    BookshelfBooks.randomize(model, random);
    const widths = books.map((book) => 0.065 * book.getLocalScale().x);
    assert.equal(new Set(widths.map((width) => width.toFixed(5))).size, 24);
    for (let row = 0; row < 3; row += 1) {
      const entries = books.slice(row * 8, row * 8 + 8);
      let edge = -0.365;
      for (const book of entries) {
        const halfWidth = 0.065 * book.getLocalScale().x / 2;
        assert.ok(book.getLocalPosition().x - halfWidth > edge);
        edge = book.getLocalPosition().x + halfWidth;
      }
      assert.ok(edge < 0.365);
    }
    for (const { book, band } of bands) {
      assert.equal(band.getLocalPosition().x, book.getLocalPosition().x);
      assert.equal(band.getLocalScale().x, book.getLocalScale().x);
    }
    sections.push(widths);
    model.destroy();
  }
  assert.notDeepEqual(sections[0], sections[1]);
});
