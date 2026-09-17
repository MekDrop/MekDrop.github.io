import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TileType } from "../../src/game/MapGenerator.js";
import { GrassWindMap } from "../../src/game/objects/ground-cover/GrassWindMap.js";

class FakeTexture {
  constructor(_device, options) {
    this.data = new Uint8Array(options.width * options.height * 4);
    this.destroyed = false;
  }

  lock() {
    return this.data;
  }

  unlock() {}

  destroy() {
    this.destroyed = true;
  }
}

const pc = {
  Texture: FakeTexture,
  PIXELFORMAT_R8_G8_B8_A8: "rgba8",
  FILTER_LINEAR: "linear",
  ADDRESS_CLAMP_TO_EDGE: "clamp",
};

function createMap() {
  const cols = 9;
  const rows = 5;
  return {
    cols,
    rows,
    grid: Array.from({ length: rows }, () =>
      Array(cols).fill(TileType.GRASS),
    ),
    vegetationData: [],
  };
}

describe("grass wind shelter", () => {
  it("reduces wind behind castle walls and recovers with distance", () => {
    const map = createMap();
    map.grid[2][3] = TileType.CASTLE_WALL;
    const windMap = new GrassWindMap({ pc, device: {}, mapData: map });
    windMap.refresh({ x: 1, z: 0 });

    const upwind = windMap.texture.data[(2 * map.cols + 2) * 4];
    const nearShadow = windMap.texture.data[(2 * map.cols + 4) * 4];
    const farShadow = windMap.texture.data[(2 * map.cols + 8) * 4];
    assert.equal(upwind, 255);
    assert.ok(nearShadow < farShadow);
    assert.ok(farShadow < upwind);
    windMap.destroy();
  });

  it("lets trees and bushes shelter nearby grass", () => {
    const map = createMap();
    map.vegetationData = [
      { col: 3, row: 2, kind: "tree" },
      { col: 6, row: 1, kind: "bush" },
    ];
    const windMap = new GrassWindMap({ pc, device: {}, mapData: map });
    windMap.refresh({ x: 1, z: 0 });

    const treeShadow = windMap.texture.data[(2 * map.cols + 4) * 4];
    const clearGrass = windMap.texture.data[(4 * map.cols + 4) * 4];
    const bushShadow = windMap.texture.data[(1 * map.cols + 7) * 4];
    assert.ok(treeShadow < clearGrass);
    assert.ok(bushShadow < clearGrass);
    windMap.destroy();
  });
});
