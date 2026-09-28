import { CASTLE_BOUNDARY } from "../../enum/CastleBoundary.js";

export const CASTLE_MATERIAL_DEFINITIONS = Object.freeze({
  castleStoneDark: Object.freeze({
    color: 0x42494c,
    texture: "castleStone",
    gloss: 0.04,
  }),
  castleStoneMid: Object.freeze({
    color: 0x5c6264,
    texture: "castleStone",
    gloss: 0.05,
  }),
  castleStoneLight: Object.freeze({
    color: 0x767b7d,
    texture: "castleStone",
    gloss: 0.06,
  }),
  castleArchStone: Object.freeze({
    color: 0xb0ada5,
    texture: "castleStone",
    gloss: 0.06,
  }),
  castleAccent: Object.freeze({
    color: 0x8a8780,
    texture: "castleStone",
    gloss: 0.06,
  }),
  castleDoor: Object.freeze({
    color: 0xffffff,
    texture: "castleDoor",
    gloss: 0.05,
  }),
  castleDoorLight: Object.freeze({
    color: 0xe8c7a5,
    texture: "castleDoor",
    gloss: 0.06,
  }),
  castleIron: Object.freeze({ color: 0x171b1d, gloss: 0.16 }),
});

export const CASTLE_STYLES = Object.freeze([
  Object.freeze({
    id: "twin-tower",
    layout: "STRAIGHT",
    towerPlacements: Object.freeze(["FRONT_LEFT", "FRONT_RIGHT"]),
    wallWings: Object.freeze([]),
    wallHeightBlocks: 11,
    towerSpanBlocks: 8,
    towerHeightBlocks: 20,
    gateShoulderSpanBlocks: 2,
    gateCrownHeightBlocks: 24,
    battlementPeriod: 2,
    visualDepthBlocks: 20,
  }),
  Object.freeze({
    id: "right-angle",
    layout: "L",
    towerPlacements: Object.freeze(["FRONT_RIGHT", "BACK_RIGHT"]),
    wallWings: Object.freeze([CASTLE_BOUNDARY.RIGHT]),
    wallHeightBlocks: 10,
    towerSpanBlocks: 9,
    towerHeightBlocks: 18,
    gateShoulderSpanBlocks: 4,
    gateCrownHeightBlocks: 22,
    battlementPeriod: 3,
    visualDepthBlocks: 24,
  }),
  Object.freeze({
    id: "single-tower",
    layout: "SINGLE_TOWER",
    towerPlacements: Object.freeze(["FRONT_RIGHT"]),
    wallWings: Object.freeze([]),
    wallHeightBlocks: 12,
    towerSpanBlocks: 8,
    towerHeightBlocks: 22,
    gateShoulderSpanBlocks: 3,
    gateCrownHeightBlocks: 26,
    battlementPeriod: 2,
    visualDepthBlocks: 20,
  }),
  Object.freeze({
    id: "left-angle",
    layout: "L",
    towerPlacements: Object.freeze(["FRONT_LEFT", "BACK_LEFT"]),
    wallWings: Object.freeze([CASTLE_BOUNDARY.LEFT]),
    wallHeightBlocks: 11,
    towerSpanBlocks: 8,
    towerHeightBlocks: 20,
    gateShoulderSpanBlocks: 2,
    gateCrownHeightBlocks: 24,
    battlementPeriod: 3,
    visualDepthBlocks: 24,
  }),
]);

export const CASTLE_BLOCK_SIZE = 0.25;
export const CASTLE_BLOCKS_PER_TILE = 4;
export const CASTLE_WALL_THICKNESS_BLOCKS = 2;
export const CASTLE_WALL_HEIGHT_BLOCKS = 15;
export const CASTLE_TOWER_SPAN_BLOCKS = 6;
export const CASTLE_TOWER_HEIGHT_BLOCKS = 18;
export const CASTLE_GATE_CROWN_HEIGHT_BLOCKS = 22;
export const CASTLE_GATE_OPENING_HEIGHT_BLOCKS = 10;
export const CASTLE_GATE_ARCH_SPRING_BLOCKS = 8;
export const CASTLE_GATE_PYLON_SPAN_BLOCKS = 5;
export const CASTLE_DOOR_WIDTH_TILES = 2;
export const CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS = 18;
export const CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS = 5;
export const CASTLE_GATE_ARCH_TILE_DEPTH_BLOCKS = 0.5;
export const CASTLE_GATE_ARCH_TILE_CENTER_DEPTH_BLOCKS = -0.25;
