import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroTerrain } from "../../../../../src/game/objects/hero/HeroTerrain.js";
import { HeroFootSupport } from "../../../../../src/game/objects/hero/HeroFootSupport.js";
import { HeroMovementSurface } from "../../../../../src/game/objects/hero/HeroMovementSurface.js";
import { MAP_TILE_TYPE as TileType } from "../../../../../src/game/enum/MapTileType.js";
import { GRASS_SURFACE_LIFT } from "../../../../../src/game/config/terrain.js";

function scenario(overrides = {}) {
  const map = {
    cols: 7,
    rows: 7,
    grid: Array.from({ length: 7 }, () => Array(7).fill(TileType.GRASS)),
    heightmap: Array.from({ length: 7 }, () => Array(7).fill(2)),
  };
  const collision = {
    surfaceHeightAt: () => null,
    physicsSurfaceHeightAt: () => null,
    ceilingHeightAt: () => null,
    isMovementBlocked: () => false,
    movementRefusalAt: () => null,
    ...overrides,
  };
  const terrain = new HeroTerrain(map, collision, []);
  const feet = new HeroFootSupport(terrain);
  const movement = new HeroMovementSurface(terrain, feet, collision);
  const state = Object.freeze({
    position: Object.freeze({ x: 0, y: 2 + GRASS_SURFACE_LIFT, z: 0 }),
    direction: Object.freeze({ x: 1, z: 0 }),
    grounded: true,
    dodging: false,
    repelled: false,
    fallingToDeath: false,
  });
  return { map, movement, state, collision };
}

it("refuses an unsupported ledge but allows a safe descent, dodge and repulsion", () => {
  const { map, movement, state } = scenario();
  for (const row of map.heightmap) row[4] = 0;
  assert.equal(movement.occupancyAt(0.3, 0, state), "edge");
  assert.equal(movement.occupancyAt(0.3, 0, { ...state, dodging: true }), "open");
  assert.equal(movement.occupancyAt(0.3, 0, { ...state, repelled: true }), "open");
  assert.equal(movement.occupancyAt(0.3, 0, { ...state, grounded: false }), "open");
  for (const row of map.heightmap) row[4] = 1;
  assert.equal(movement.occupancyAt(0.3, 0, state), "open");
});

it("uses current query state after relocation and retains forward torso clearance", () => {
  const { map, movement, state } = scenario();
  map.heightmap[3][4] = 4;
  assert.equal(movement.occupancyAt(0.05, 0, state), "blocked");
  assert.equal(movement.occupancyAt(0.05, 0, { ...state, position: { x: 0, y: 4 + GRASS_SURFACE_LIFT, z: 0 }, grounded: false }), "open");
  assert.equal(movement.occupancyAt(0.05, 0, { ...state, direction: { x: -1, z: 0 } }), "open");
});

it("leaves ledge contact to physics-managed supports without exempting authored surfaces", () => {
  const { map, movement, state, collision } = scenario();
  for (const row of map.heightmap) row[4] = 0;
  collision.surfaceHeightAt = (x) => x <= 0 ? state.position.y : null;
  assert.equal(movement.occupancyAt(0.3, 0, state), "open");
  collision.physicsSurfaceHeightAt = () => state.position.y;
  assert.equal(movement.occupancyAt(0.3, 0, state), "edge");
});

it("checks the ceiling and scenery at the hero's elevation and forward footprint", () => {
  const { movement, state, collision } = scenario();
  collision.ceilingHeightAt = () => 3;
  assert.equal(movement.occupancyAt(0.1, 0, state), "blocked");
  collision.ceilingHeightAt = () => 5;
  const probes = [];
  collision.isMovementBlocked = (...args) => { probes.push(args); return args[2] > 0.3; };
  assert.equal(movement.occupancyAt(0.1, 0, state), "blocked");
  assert.equal(probes.length, 2);
  assert.equal(probes[0][5], state.position.y);
  assert.ok(probes[1][2] > probes[0][2]);
});

it("queries hole refusal at the body then the forward footprint with nullish fallback", () => {
  const { movement, state, collision } = scenario();
  const probes = [];
  collision.movementRefusalAt = (...args) => { probes.push(args); return args[0] > 0.2 ? "hole" : null; };
  assert.equal(movement.refusalAt(0, 0, state.position.y, state.direction), "hole");
  assert.equal(probes.length, 2);
  assert.equal(probes[1][3], state.position.y);
  probes.length = 0;
  collision.movementRefusalAt = (...args) => { probes.push(args); return "hole"; };
  assert.equal(movement.refusalAt(0, 0, state.position.y, state.direction), "hole");
  assert.equal(probes.length, 1);
});

it("keeps angry escape on connected level ground with clearance for the full route", () => {
  const { map, movement, state, collision } = scenario();
  const target = { x: 2, y: state.position.y, z: 0 };
  assert.equal(movement.canEscapeAcross(state.position, target, state), true);
  map.grid[3][4] = TileType.WATER;
  assert.equal(movement.canEscapeAcross(state.position, target, state), false);
  map.grid[3][4] = TileType.GRASS;
  map.heightmap[3][4] = 1;
  assert.equal(movement.canEscapeAcross(state.position, target, state), false);
  map.heightmap[3][4] = 2;
  collision.ceilingHeightAt = (x) => x > 0.5 && x < 1.5 ? 3 : null;
  assert.equal(movement.canEscapeAcross(state.position, target, state), false);
});
