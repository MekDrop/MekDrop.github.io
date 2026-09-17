import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TileType } from "../../src/game/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../src/game/config/terrain.js";
import { GrassObstacleMap } from "../../src/game/objects/ground-cover/GrassObstacleMap.js";

class FakeTexture {
  constructor(_device, options) {
    this.options = options;
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

function createMapData(cols = 1, rows = 1) {
  return {
    cols,
    rows,
    grid: Array.from({ length: rows }, () =>
      Array(cols).fill(TileType.GRASS),
    ),
    heightmap: Array.from({ length: rows }, () => Array(cols).fill(2)),
    tileMeta: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({})),
    ),
    riverData: [],
  };
}

function createSubject(mapData = createMapData()) {
  return new GrassObstacleMap({
    pc,
    device: {},
    mapData,
  });
}

describe("grass obstacle field", () => {
  it("scales grass pressure below an object with its weight", () => {
    const obstacleMap = createSubject();
    const elevations = [];
    obstacleMap.refresh((x, y, z) => {
      elevations.push(y);
      return Math.hypot(x, z) < 0.16 ? 0.5 : 0;
    });

    const data = obstacleMap.texture.data;
    const occupied = [];
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] > 0) {
        occupied.push(data.slice(offset, offset + 4));
      }
    }
    assert.ok(occupied.length > 0);
    assert.ok(occupied.every((pixel) => Math.abs(pixel[2] - 128) <= 1));
    assert.ok(occupied.every((pixel) => Math.abs(pixel[3] - 128) <= 1));
    assert.ok(
      elevations.every(
        (value) => Math.abs(value - (2 + GRASS_SURFACE_LIFT - 0.002)) < 1e-10,
      ),
    );
    obstacleMap.destroy();
  });

  it("bends neighboring grass away from a weighted footprint", () => {
    const obstacleMap = createSubject();
    obstacleMap.refresh((x, _y, z) =>
      Math.hypot(x, z) < 0.16 ? 0.5 : 0,
    );

    const data = obstacleMap.texture.data;
    let bentOutside = null;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (
        data[offset + 2] > 0 &&
        data[offset + 3] === 0 &&
        data[offset + 2] < 255
      ) {
        bentOutside = data.slice(offset, offset + 4);
        break;
      }
    }
    assert.ok(bentOutside);
    assert.ok(bentOutside[0] !== 128 || bentOutside[1] !== 128);
    obstacleMap.destroy();
  });

  it("makes heavy objects push neighboring grass farther than light ones", () => {
    const lightMap = createSubject();
    const heavyMap = createSubject();
    lightMap.refresh((x, _y, z) =>
      Math.hypot(x, z) < 0.16 ? 0.2 : 0,
    );
    heavyMap.refresh((x, _y, z) =>
      Math.hypot(x, z) < 0.16 ? 1 : 0,
    );

    let lightOuterPressure = 0;
    let heavyOuterPressure = 0;
    for (let offset = 0; offset < lightMap.texture.data.length; offset += 4) {
      if (
        lightMap.texture.data[offset + 2] < 200 &&
        heavyMap.texture.data[offset + 2] < 200
      ) {
        lightOuterPressure = Math.max(
          lightOuterPressure,
          lightMap.texture.data[offset + 2],
        );
        heavyOuterPressure = Math.max(
          heavyOuterPressure,
          heavyMap.texture.data[offset + 2],
        );
      }
    }
    assert.ok(heavyOuterPressure > lightOuterPressure);
    lightMap.destroy();
    heavyMap.destroy();
  });

  it("binds the obstruction texture and world size to a grass material", () => {
    const obstacleMap = createSubject();
    const parameters = new Map();
    obstacleMap.apply({
      setParameter(name, value) {
        parameters.set(name, value);
      },
    });

    assert.equal(parameters.get("uGrassObstacleMap"), obstacleMap.texture);
    assert.deepEqual(parameters.get("uGrassObstacleMapSize"), [1, 1]);
    obstacleMap.destroy();
  });

  it("updates only the removed obstacle neighborhood", () => {
    const mapData = createMapData(5, 5);
    const localMap = createSubject(mapData);
    const fullMap = createSubject(mapData);
    const initialWeight = (x, _y, z) =>
      Math.hypot(x, z) < 0.18 || Math.hypot(x + 2, z + 2) < 0.18
        ? 1
        : 0;
    localMap.refresh(initialWeight);
    fullMap.refresh(initialWeight);

    let localSamples = 0;
    let fullSamples = 0;
    const remainingWeight = (x, _y, z) =>
      Math.hypot(x + 2, z + 2) < 0.18 ? 1 : 0;
    localMap.refresh(
      (x, y, z) => {
        localSamples += 1;
        return remainingWeight(x, y, z);
      },
      { col: 2, row: 2 },
    );
    fullMap.refresh((x, y, z) => {
      fullSamples += 1;
      return remainingWeight(x, y, z);
    });

    assert.ok(localSamples < fullSamples / 2);
    assert.deepEqual(localMap.texture.data, fullMap.texture.data);
    localMap.destroy();
    fullMap.destroy();
  });
});
