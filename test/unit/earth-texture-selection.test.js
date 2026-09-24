import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEarthTextureVariants } from "../../src/game/EarthTextureSelection.js";
import { MapGenerator } from "../../src/game/MapGenerator.js";
import {
  EARTH_TEXTURE_VARIANT_COUNT,
  MAX_UNDERSIDE_DEPTH,
} from "../../src/game/config/terrain.js";

describe("earth texture selection", () => {
  it("assigns a stable texture to every dirt block during generation", () => {
    const map = MapGenerator.generate({
      mapName: "dirt-foundation",
      numPaths: 3,
      numRivers: 0,
    });
    const selection = map.earthTextureVariants;
    const repeated = createEarthTextureVariants(map);

    assert.deepEqual(selection, repeated);
    assert.equal(selection.firstLevel, -MAX_UNDERSIDE_DEPTH);
    assert.equal(selection.tiles.length, map.rows);

    for (let row = 0; row < map.rows; row += 1) {
      assert.equal(selection.tiles[row].length, map.cols);
      for (let col = 0; col < map.cols; col += 1) {
        const variants = selection.tiles[row][col];
        assert.ok(variants.length >= MAX_UNDERSIDE_DEPTH + map.heightmap[row][col]);
        assert.ok(
          variants.every(
            (variant) =>
              Number.isInteger(variant) &&
              variant >= 0 &&
              variant < EARTH_TEXTURE_VARIANT_COUNT,
          ),
        );
      }
    }
    assert.ok(
      new Set(selection.tiles.flat(2)).size > 1,
      "generated dirt blocks should use multiple texture variants",
    );
  });
});