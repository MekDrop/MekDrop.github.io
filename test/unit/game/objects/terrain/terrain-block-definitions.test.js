import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../../../../src/game/config/terrain.js";

function map() {
  return { cols: 2, rows: 2, grid: [[1, 1], [1, 0]], heightmap: [[2, 1], [1, 0]], tileMeta: [[{}, {}], [{}, {}]], objects: [{ id: "authored", object: "Earth", position: { x: 0, y: 4.5, z: 0 } }] };
}

describe("terrain map-object integration", () => {
  it("materializes surface, fill, and underside blocks without changing authored definitions or grid", () => {
    const subject = map();
    const authored = subject.objects[0];
    const grid = structuredClone(subject.grid);
    TerrainBlockDefinitions.populate(subject);
    const grass = subject.objects.filter((definition) => definition.object === "Grass");
    assert.equal(grass.length, 3);
    const top = grass.find(({ tile }) => tile.col === 0 && tile.row === 0);
    assert.deepEqual(top.position, { x: -0.5, y: 1.5, z: -0.5 });
    assert.equal(top.geometry.args[7], GRASS_SURFACE_LIFT);
    assert.ok(subject.objects.some(({ object, position }) => object === "Earth" && position.y < 0));
    const fill = subject.objects.find(({ generated, tile, position }) => generated && tile.col === 0 && tile.row === 0 && position.y === 0.5);
    assert.equal(fill.object, "Earth");
    assert.equal(fill.geometry.args[5], "none");
    assert.equal(fill.geometry.args[6], "earth");
    assert.equal(subject.objects.at(-1), authored);
    assert.deepEqual(subject.grid, grid);
    const count = subject.objects.length;
    TerrainBlockDefinitions.populate(subject);
    assert.equal(subject.objects.length, count, "loading/rendering does not duplicate generated blocks");
  });

  it("publishes deterministic object records from generated maps, retaining the original terrain", async () => {
    const options = { mapName: "terrain-object-contract", numPaths: 2, numRivers: 0 };
    const first = await MapGenerator.generate(options);
    const second = await MapGenerator.generate(options);
    assert.deepEqual(first.objects, second.objects);
    assert.deepEqual(first.grid, second.grid);
    assert.deepEqual(first.renderCommands, second.renderCommands);
    assert.ok(first.objects.some(({ object }) => object === "Grass"));
    assert.ok(first.objects.some(({ object }) => object === "Earth"));
    assert.ok(first.objects.some(({ object }) => object === "Castle"));
    assert.ok(first.renderCommands.every(({ args }) => !args[0].startsWith("grass:")), "generic mesh commands contain no grass surfaces");
  });
});
