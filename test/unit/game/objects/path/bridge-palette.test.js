import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, StandardMaterial } from "playcanvas";
import { BridgePalette } from "../../../../../src/game/objects/path/BridgePalette.js";

it("keeps bridge colour variants local and releases them with their visual owner", () => {
  const source = new StandardMaterial();
  const root = new Entity();
  const palette = new BridgePalette(root);
  const deck = palette.materialFor(source, "deck");
  const frame = palette.materialFor(source, "frame");
  let released = 0;
  for (const material of [deck, frame]) {
    const destroy = material.destroy.bind(material);
    material.destroy = () => {
      released++;
      destroy();
    };
  }
  assert.notEqual(deck, frame);
  assert.notEqual(deck, source);
  assert.equal(palette.materialFor(source, "deck"), deck);
  assert.equal(palette.materialFor(source, "lift"), source);
  assert.equal(source.diffuse.r, 1);
  assert.equal(source.diffuse.g, 1);
  assert.equal(source.diffuse.b, 1);
  root.destroy();
  assert.equal(released, 2);
  source.destroy();
});
