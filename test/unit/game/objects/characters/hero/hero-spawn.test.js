import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroSpawn } from "../../../../../../src/game/objects/characters/hero/HeroSpawn.js";
import { MAP_TILE_TYPE as TileType } from "../../../../../../src/game/enum/MapTileType.js";
import { GRASS_SURFACE_LIFT } from "../../../../../../src/game/config/terrain.js";

it("copies an explicit spawn and faces the castle center", () => {
  const map = {
    cols: 5,
    rows: 5,
    heroSpawn: {
      x: -2,
      y: 7,
      z: 0,
    },
    castle: {
      position: {
        col: 2,
        row: 2,
        width: 1,
        depth: 1,
      },
    },
  };
  const spawn = new HeroSpawn(map, null, {
    x: 0,
    z: 0,
  });
  const position = spawn.position;
  assert.deepEqual(position, map.heroSpawn);
  assert.notEqual(position, map.heroSpawn);
  assert.equal(spawn.facingYaw(position), 90);
  assert.equal(spawn.facingYaw({
    x: 0,
    z: 0,
  }), 0);
});

it("prefers grass with two reachable exits over a closer isolated tile", () => {
  const map = {
    cols: 5,
    rows: 3,
    grid: [
      [TileType.WATER, TileType.WATER, TileType.WATER, TileType.PATH, TileType.WATER],
      [TileType.GRASS, TileType.WATER, TileType.WATER, TileType.GRASS, TileType.PATH],
      [TileType.WATER, TileType.WATER, TileType.WATER, TileType.WATER, TileType.WATER],
    ],
    heightmap: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
  };
  const spawn = new HeroSpawn(map, null, {
    x: -2,
    z: 0,
  });
  assert.deepEqual(spawn.position, {
    x: 1,
    y: 1 + GRASS_SURFACE_LIFT,
    z: 0,
  });
  // Losing one exit makes both candidates unsafe, restoring nearest-grass fallback.
  const blocked = { isBlocked: (x, z) => x === 1 && z === -1 };
  assert.equal(new HeroSpawn(map, blocked, {
    x: -2,
    z: 0,
  }).position.x, -2);
});

it("preserves scan order on distance ties and uses the empty-map fallback", () => {
  const map = {
    cols: 2,
    rows: 1,
    grid: [[TileType.GRASS, TileType.GRASS]],
    heightmap: [[2, 2]],
  };
  const spawn = new HeroSpawn(map, null, {
    x: 0,
    z: 0,
  });
  assert.equal(spawn.position.x, -0.5);
  assert.equal(spawn.facingYaw(spawn.position), 0);
  assert.deepEqual(new HeroSpawn(map, { isBlocked: () => true }, {
    x: 0,
    z: 0,
  }).position,
  {
    x: 0,
    y: 1,
    z: 0,
  });
});
