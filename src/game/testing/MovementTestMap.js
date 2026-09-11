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
      case "inventory":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        this.#addInventoryGroundCover(mapData);
        break;
      case "inventory-overlap":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.groundCoverData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW + 1,
            variant: "daisy-patch",
            offsetX: 0,
            offsetZ: -0.02,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
        ];
        break;
      case "inventory-on-flower":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.groundCoverData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW,
            variant: "daisy-patch",
            offsetX: 0,
            offsetZ: 0,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
        ];
        break;
      case "inventory-mushroom":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.groundCoverData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW,
            variant: "red-mushroom",
            offsetX: 0,
            offsetZ: 0.58,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
        ];
        break;
      case "inventory-mushroom-dig":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.groundCoverData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW + 1,
            variant: "red-mushroom",
            offsetX: 0,
            offsetZ: -0.2,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
        ];
        break;
      case "tree-dig":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.vegetationData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW + 1,
            variant: "oak",
            rotation: 0,
          },
        ];
        break;
      case "inventory-direction":
        this.#paint(mapData, 1, 2, 7, 4, 2);
        mapData.groundCoverData = [
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW - 1,
            variant: "pink-flower-patch",
            offsetX: 0,
            offsetZ: 0.1,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
          {
            col: this.#SPAWN_COL,
            row: this.#SPAWN_ROW + 1,
            variant: "daisy-patch",
            offsetX: 0,
            offsetZ: -0.1,
            rotation: 0,
            scale: 1,
            phase: 0,
          },
        ];
        break;
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
      case "river-current":
        this.#addRiver(mapData, true);
        break;
      case "river-source-cover":
        this.#addRiver(mapData, false);
        mapData.heroSpawn.x =
          2 - (this.#COLS - 1) / 2 - 0.25;
        mapData.heroSpawn.y = 2 + GRASS_SURFACE_LIFT;
        break;
      case "river-high-bridge":
        this.#addRiver(mapData, true, 0.5);
        break;
      case "river-waterfall":
        this.#addRiver(mapData, false);
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
      riverData: [],
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

  static #addRiver(mapData, includesBridge, waterElevation = 1.5) {
    this.#paint(mapData, 0, 2, 8, 4, 2);
    mapData.heroSpawn.x = -(this.#COLS - 1) / 2;
    const cells = [];
    for (let col = 2; col <= 8; col += 1) {
      const underBridge = includesBridge && (col === 6 || col === 7);
      if (underBridge) {
        mapData.grid[3][col] = TileType.PATH;
        mapData.heightmap[3][col] = 2;
        mapData.tileMeta[3][col] = {
          baseHeight: 2,
          direction: "SOUTH",
          renderMode: "BRIDGE",
          surfaceType: "PATH",
        };
      } else {
        mapData.grid[3][col] = TileType.WATER;
        mapData.heightmap[3][col] = waterElevation;
        mapData.tileMeta[3][col] = {
          baseHeight: waterElevation,
          direction: "EAST",
          renderMode: "SOLID",
          riverSourceCover: col === 2,
          surfaceType: "WATER",
        };
      }
      cells.push({
        col,
        row: 3,
        direction: "EAST",
        elevation: waterElevation,
        bedElevation: Math.max(0, waterElevation - 0.5),
        terrainHeight: 2,
        underBridge,
      });
    }
    mapData.riverData = [
      {
        id: "movement-test-river",
        source: { col: 2, row: 3, terrainHeight: 2 },
        cells,
        cascades: [],
        upstreamLength: cells.length - 2,
        waterfall: {
          col: 8,
          row: 3,
          direction: "EAST",
          topElevation: waterElevation,
          bottomElevation: -10,
        },
      },
    ];
  }

  static #addInventoryGroundCover(mapData) {
    const variants = [
      "daisy-patch",
      "red-mushroom",
      "buttercup-patch",
      "golden-mushroom-pair",
      "pink-flower-patch",
      "forest-mushroom-cluster",
      "blue-flower-patch",
      "red-mushroom",
      "clover-patch",
      "golden-mushroom-pair",
      "daisy-patch",
      "forest-mushroom-cluster",
      "pink-flower-patch",
    ];
    mapData.groundCoverData = variants.map((variant, index) => ({
      col: this.#SPAWN_COL,
      row: this.#SPAWN_ROW,
      variant,
      offsetX: ((index % 5) - 2) * 0.025,
      offsetZ: 0.34 + (index % 3) * 0.03,
      rotation: (index * 45) % 360,
      scale: 1,
      phase: index * 0.4,
    }));
  }
}
