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

function createSubject() {
  return new GrassObstacleMap({
    pc,
    device: {},
    mapData: {
      cols: 1,
      rows: 1,
      grid: [[TileType.GRASS]],
      heightmap: [[2]],
      tileMeta: [[{}]],
      riverData: [],
    },
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
      if (data[offset + 2] > 100) {
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
      if (data[offset + 2] > 0 && data[offset + 3] > 0 && data[offset + 2] < 255) {
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
});
