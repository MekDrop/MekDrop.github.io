import { TileType } from "../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../config/terrain.js";

export class MovementTestMap {
  static #COLS = 9;
  static #ROWS = 7;
  static #SPAWN_COL = 2;
  static #SPAWN_ROW = 3;

  static create(scenario = "flat") {
    const mapData = this.#emptyMap(scenario);

    switch (scenario) {
      case "safe-descent":
      case "jump-descent":
        this.#paint(mapData, 1, 2, 3, 4, 2);
        this.#paint(mapData, 4, 2, 7, 4, 1);
        break;
      case "jump-ascent":
        this.#paint(mapData, 1, 2, 3, 4, 1);
        this.#paint(mapData, 4, 2, 7, 4, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        break;
      case "jump-ascent-corner":
        this.#paint(mapData, 1, 3, 3, 3, 1);
        this.#paint(mapData, 4, 2, 7, 3, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        mapData.heroSpawn.z = 0.25;
        break;
      case "jump-ascent-gap":
        this.#paint(mapData, 1, 3, 2, 3, 1);
        this.#paint(mapData, 4, 2, 7, 4, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        break;
      case "jump-ascent-partial-feet":
        this.#paint(mapData, 1, 2, 3, 4, 1);
        this.#paint(mapData, 4, 2, 7, 4, 2);
        mapData.heroSpawn.x = -2.45;
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        break;
      case "partial-raised-start":
        this.#paint(mapData, 1, 2, 3, 4, 1);
        this.#paint(mapData, 4, 2, 7, 4, 2);
        mapData.heroSpawn.x = -0.5;
        break;
      case "narrow-landing":
        this.#paint(mapData, 1, 2, 3, 4, 2);
        this.#paint(mapData, 4, 3, 7, 3, 1);
        break;
      case "deep-drop":
        this.#paint(mapData, 1, 2, 3, 4, 3);
        this.#paint(mapData, 4, 2, 7, 4, 1);
        mapData.heroSpawn.y = 3 + GRASS_SURFACE_LIFT;
        break;
      case "void-edge":
        this.#paint(mapData, 1, 2, 4, 4, 2);
        break;
      case "parallel-edge":
        this.#paint(mapData, 1, 3, 7, 3, 2);
        this.#paint(mapData, 1, 4, 7, 4, 1);
        mapData.heroSpawn.z = 0.38;
        break;
      case "parallel-edge-right":
        this.#paint(mapData, 1, 3, 7, 3, 2);
        this.#paint(mapData, 1, 2, 7, 2, 1);
        mapData.heroSpawn.z = -0.38;
        break;
      case "higher-cube":
        this.#paint(mapData, 1, 2, 3, 4, 1);
        this.#paint(mapData, 4, 2, 7, 4, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        break;
      case "raised-corner":
        this.#paint(mapData, 1, 1, 7, 5, 1);
        this.#paint(mapData, 4, 1, 7, 3, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        mapData.heroSpawn.z = 0.79;
        break;
      case "raised-pocket":
        this.#paint(mapData, 1, 1, 7, 5, 1);
        this.#paint(mapData, 4, 1, 7, 3, 2);
        this.#paint(mapData, 1, 4, 7, 5, 2);
        mapData.heroSpawn.x = -0.7;
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        mapData.heroSpawn.z = 0.2;
        break;
      case "narrow-corridor":
        this.#paint(mapData, 1, 3, 7, 3, 1);
        this.#paint(mapData, 1, 2, 7, 2, 2);
        this.#paint(mapData, 1, 4, 7, 4, 2);
        mapData.heroSpawn.y = 1 + GRASS_SURFACE_LIFT;
        break;
      default:
        this.#paint(mapData, 1, 2, 7, 4, 2);
        break;
    }

    return mapData;
  }

  static #emptyMap(scenario) {
    const grid = Array.from({ length: this.#ROWS }, () =>
      new Array(this.#COLS).fill(TileType.WATER),
    );
    const heightmap = Array.from({ length: this.#ROWS }, () =>
      new Array(this.#COLS).fill(0),
    );
    const tileMeta = Array.from({ length: this.#ROWS }, () =>
      Array.from({ length: this.#COLS }, () => ({})),
    );
    return {
      grid,
      heightmap,
      tileMeta,
      cols: this.#COLS,
      rows: this.#ROWS,
      entries: [],
      castle: null,
      numPaths: 0,
      paths: [],
      arrowData: [],
      vegetationData: [],
      groundCoverData: [],
      pipeData: new Map(),
      mergeZones: [],
      trunkStart: null,
      layoutSignature: `movement-test-${scenario}`,
      heroSpawn: {
        x: this.#SPAWN_COL - (this.#COLS - 1) / 2,
        y: 2 + GRASS_SURFACE_LIFT,
        z: this.#SPAWN_ROW - (this.#ROWS - 1) / 2,
      },
    };
  }

  static #paint(mapData, left, top, right, bottom, height) {
    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        mapData.grid[row][col] = TileType.GRASS;
        mapData.heightmap[row][col] = height;
        mapData.tileMeta[row][col] = {
          baseHeight: height,
          renderMode: "SOLID",
          surfaceType: "GRASS",
        };
      }
    }
  }
}
