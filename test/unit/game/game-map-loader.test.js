import assert from "node:assert/strict";
import { it } from "node:test";
import { GameMapLoader } from "../../../src/game/GameMapLoader.js";

function fixture() {
  return { cols: 3, rows: 2, grid: [[1, 1, 0], [1, 2, 1]],
    heightmap: [[2, 2, 0], [2, 2, 2]], tileMeta: [[{}, { shape: "SLOPE" }, {}], [{}, {}, {}]],
    objects: [{ object: "StoneCluster", tile: { col: 0, row: 1 } }] };
}

it("assigns fresh treasure and contents after generation without mutating the source map", () => {
  const generated = fixture();
  const original = structuredClone(generated);
  const first = GameMapLoader.load(generated, () => 0.1);
  const second = GameMapLoader.load(generated, () => 0.9);
  assert.deepEqual(generated, original);
  const chests = first.objects.filter((cube) => cube.buriedTreasure);
  assert.equal(chests.length, 2);
  assert.deepEqual(chests.map((cube) => cube.tile), [{ col: 0, row: 0 }, { col: 2, row: 1 }]);
  for (const cube of chests) {
    assert.equal(cube.object, "Grass");
    assert.equal(cube.position.y, first.heightmap[cube.tile.row][cube.tile.col] - 0.5);
    assert.deepEqual(cube.buriedTreasure.contents, Array(5).fill("gold"));
  }
  assert.equal(second.objects.filter((cube) => cube.buriedTreasure).length, 0);
});

it("clears stale assignments and rejects duplicate, out-of-bounds, non-cube, and covered positions", () => {
  const map = GameMapLoader.load(fixture(), () => 0.1);
  const cube = map.objects.find((item) => item.buriedTreasure);
  map.objects.push(structuredClone(cube), { ...structuredClone(cube), tile: { col: -1, row: 0 } },
    { ...structuredClone(cube), geometry: { method: "addBoxMatrix", args: [] } });
  map.tileMeta[1][2].bridgeGroundHeight = 2;
  const loaded = GameMapLoader.load(map, () => 0.1);
  assert.equal(loaded.objects.filter((item) => item.buriedTreasure).length, 1);
  const empty = GameMapLoader.load(loaded, () => 0.9);
  assert.equal(empty.objects.filter((item) => item.buriedTreasure).length, 0);
});
