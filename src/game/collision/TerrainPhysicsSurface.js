import { subtractTerrainCutouts } from "./TerrainSurfaceCutouts.js";
import { TileType } from "../generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { SLOPE_DIRECTION } from "../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../enum/TileShape.js";

const COLLISION_BASE_HEIGHT = -16;
const SUPPLEMENTAL_SAMPLE_SIZE = 0.25;
const SURFACE_EPSILON = 0.01;
const BRIDGE_DECK_THICKNESS = 0.24;
const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
const GRASS_SURFACE_TILES = new Set([TileType.GRASS]);

/**
 * Builds the static walkable world consumed by PlayCanvas' physics backend.
 */
export class TerrainPhysicsSurface {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameMapData}
   */
  #mapData;
  /**
   *
   * @type {GroundCollisionWorld}
   */
  #collisionWorld;
  /**
   *
   * @type {pc.Entity}
   */
  #entity;
  /**
   *
   * @type {null}
   */
  #mesh = null;
  /**
   *
   * @type {null}
   */
  #model = null;
  /**
   *
   * @type {null}
   */
  #material = null;
  /**
   *
   * @type {Map}
   */
  #sourceCovers = new Map();
  /**
   * @type {Set<string>}
   */
  #riverBridges = new Set();

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, mapData: import("src/game/GameContracts.js").GameMapData, collisionWorld: GroundCollisionWorld}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   * @param {GroundCollisionWorld} options.collisionWorld
   */
  constructor({ pc, app, mapData, collisionWorld }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameMapData}
     */
    this.#mapData = mapData;
    /**
     *
     * @type {GroundCollisionWorld}
     */
    this.#collisionWorld = collisionWorld;
    /**
     *
     * @type {pc.Entity}
     */
    this.#entity = new pc.Entity("Terrain physics surface");
    this.#entity.tags.add("terrain-physics-surface");
    this.#indexSourceCovers();
    this.refresh();
    this.#app.on?.("bridge:collapsed", this.#onBridgeCollapsed, this);
  }

  get entity() {
    return this.#entity;
  }

  refresh() {
    if (!this.#entity) {
      return;
    }
    if (this.#entity.rigidbody) {
      this.#entity.removeComponent("rigidbody");
    }
    if (this.#entity.collision) {
      this.#entity.removeComponent("collision");
    }
    this.#mesh?.destroy();
    this.#material?.destroy();

    const geometry = this.#buildGeometry();
    this.#mesh = new this.#pc.Mesh(this.#app.graphicsDevice);
    this.#mesh.setPositions(geometry.positions);
    this.#mesh.setIndices(geometry.indices);
    this.#mesh.update();

    this.#material = new this.#pc.StandardMaterial();
    this.#material.name = "Terrain physics surface material";
    this.#material.update();
    const node = new this.#pc.GraphNode("Terrain physics surface mesh");
    const meshInstance = new this.#pc.MeshInstance(
      this.#mesh,
      this.#material,
      node,
    );
    this.#model = new this.#pc.Model();
    this.#model.graph = node;
    this.#model.meshInstances = [meshInstance];
    this.#entity.addComponent("collision", {
      type: "mesh",
      model: this.#model,
    });
    this.#entity.addComponent("rigidbody", {
      type: "static",
      friction: 0,
      restitution: 0,
    });
  }

  destroy() {
    this.#app.off?.("bridge:collapsed", this.#onBridgeCollapsed, this);
    this.#entity?.destroy();
    this.#mesh?.destroy();
    this.#material?.destroy();
    this.#entity = null;
    this.#mesh = null;
    this.#model = null;
    this.#material = null;
    this.#sourceCovers.clear();
    this.#riverBridges.clear();
  }

  /**
   * @param {{map: import("../GameContracts.js").GameMapData}} event
   */
  #onBridgeCollapsed(event) {
    if (event.map === this.#mapData) {
      this.refresh();
    }
  }

  #indexSourceCovers() {
    for (const river of this.#mapData.riverData ?? []) {
      for (const cell of river.cells ?? []) {
        if (cell.underBridge) {
          this.#riverBridges.add(`${cell.col},${cell.row}`);
        }
      }
      const source = river.cells?.[0];
      if (!source) {
        continue;
      }
      this.#sourceCovers.set(
        `${source.col},${source.row}`,
        source.terrainHeight + GRASS_SURFACE_LIFT,
      );
    }
  }

  #buildGeometry() {
    const positions = [];
    const indices = [];
    const tiles = Array.from(
      { length: this.#mapData.rows },
      this.#from.bind(this),
    );
    for (let row = 0; row < this.#mapData.rows; row += 1) {
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        tiles[row][col] = this.#tileSurface(col, row);
      }
    }

    for (let row = 0; row < this.#mapData.rows; row += 1) {
      let topEnd = -1;
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        const surface = tiles[row][col];
        if (!surface) {
          continue;
        }
        if (col > topEnd) {
          topEnd = col;
          if (this.#canMergeTop(col, row, surface)) {
            while (
              topEnd + 1 < this.#mapData.cols &&
              this.#canMergeTop(topEnd + 1, row, tiles[row][topEnd + 1]) &&
              tiles[row][topEnd + 1][0] === surface[0]
            ) {
              topEnd += 1;
            }
          }
          this.#addTileTop(positions, indices, col, row, surface, topEnd - col + 1);
        }
        this.#addExposedTileSides(
          positions,
          indices,
          tiles,
          col,
          row,
          surface,
        );
      }
    }
    this.#addSupplementalSurfaces(positions, indices, tiles);
    this.#addOverpassDeck(positions, indices);

    return {
      positions,
      indices,
    };
  }

  /**
   * Only uncut, flat terrain tops can share a face. Bridge undersides and all
   * exposed sides retain their original per-tile geometry.
   * @param {number} col
   * @param {number} row
   * @param {number[]|null} surface
   * @returns {boolean}
   */
  #canMergeTop(col, row, surface) {
    return Boolean(surface) && surface[0] === surface[1] &&
      surface[0] === surface[2] && surface[0] === surface[3] &&
      !this.#mapData.tileMeta?.[row]?.[col]?.terrainCutouts?.length &&
      !this.#isBridge(col, row);
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   */
  #tileSurface(col, row) {
    const type = this.#mapData.grid[row][col];
    const collapsed = this.#mapData.tileMeta?.[row]?.[col];
    if (collapsed?.bridgeCollapsed) {
      const ground = collapsed.bridgeGroundHeight;

      return Number.isFinite(ground) ? [ground, ground, ground, ground] : null;
    }
    const sourceCover = this.#sourceCovers.get(`${col},${row}`);
    if (!WALKABLE_TILES.has(type) && !Number.isFinite(sourceCover)) {
      return null;
    }
    if (Number.isFinite(sourceCover)) {
      return [sourceCover, sourceCover, sourceCover, sourceCover];
    }
    const metadata = this.#mapData.tileMeta?.[row]?.[col];
    const slope = metadata?.slope;
    if (metadata?.shape === TILE_SHAPE.SLOPE && slope) {
      const northHeight =
        slope.riseDirection === SLOPE_DIRECTION.NORTH
          ? slope.highHeight
          : slope.riseDirection === SLOPE_DIRECTION.SOUTH
            ? slope.lowHeight
            : null;
      const southHeight =
        slope.riseDirection === SLOPE_DIRECTION.SOUTH
          ? slope.highHeight
          : slope.riseDirection === SLOPE_DIRECTION.NORTH
            ? slope.lowHeight
            : null;
      const westHeight =
        slope.riseDirection === SLOPE_DIRECTION.WEST
          ? slope.highHeight
          : slope.riseDirection === SLOPE_DIRECTION.EAST
            ? slope.lowHeight
            : null;
      const eastHeight =
        slope.riseDirection === SLOPE_DIRECTION.EAST
          ? slope.highHeight
          : slope.riseDirection === SLOPE_DIRECTION.WEST
            ? slope.lowHeight
            : null;

      return [
        northHeight ?? westHeight,
        northHeight ?? eastHeight,
        southHeight ?? eastHeight,
        southHeight ?? westHeight,
      ];
    }
    const height =
      this.#mapData.heightmap[row][col] +
      (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0);

    return [height, height, height, height];
  }

  /**
   *
   * @param {number[]} positions
   * @param {number[]} indices
   * @param {number} col
   * @param {number} row
   * @param {number[]} heights
   * @param {number} width
   */
  #addTileTop(positions, indices, col, row, heights, width = 1) {
    const x = col - (this.#mapData.cols - 1) / 2;
    const z = row - (this.#mapData.rows - 1) / 2;
    this.#addTerrainQuad(
      positions,
      indices,
      this.#mapData.tileMeta?.[row]?.[col]?.terrainCutouts ?? [],
      [x - 0.5, heights[0], z - 0.5],
      [x + width - 0.5, heights[1], z - 0.5],
      [x + width - 0.5, heights[2], z + 0.5],
      [x - 0.5, heights[3], z + 0.5],
    );
    if (this.#isBridge(col, row)) {
      this.#addTerrainQuad(
        positions,
        indices,
        this.#mapData.tileMeta?.[row]?.[col]?.terrainCutouts ?? [],
        [x - 0.5, heights[3] - BRIDGE_DECK_THICKNESS, z + 0.5],
        [x + 0.5, heights[2] - BRIDGE_DECK_THICKNESS, z + 0.5],
        [x + 0.5, heights[1] - BRIDGE_DECK_THICKNESS, z - 0.5],
        [x - 0.5, heights[0] - BRIDGE_DECK_THICKNESS, z - 0.5],
      );
    }
  }

  /**
   * @param {number} col
   * @param {number} row
   * @returns {boolean}
   */
  #isBridge(col, row) {
    const metadata = this.#mapData.tileMeta?.[row]?.[col];

    return !metadata?.bridgeCollapsed &&
      (metadata?.renderMode === "BRIDGE" || this.#riverBridges.has(`${col},${row}`));
  }

  /**
   *
   * @param {number[]} positions
   * @param {number[]} indices
   * @param {Array<Array<number[]|null>>} tiles
   * @param {number} col
   * @param {number} row
   * @param {number[]} heights
   */
  #addExposedTileSides(positions, indices, tiles, col, row, heights) {
    const x = col - (this.#mapData.cols - 1) / 2;
    const z = row - (this.#mapData.rows - 1) / 2;
    const sides = [
      {
        dc: 0,
        dr: -1,
        a: [x - 0.5, z - 0.5, heights[0]],
        b: [x + 0.5, z - 0.5, heights[1]],
        neighbour: [3, 2],
      },
      {
        dc: 1,
        dr: 0,
        a: [x + 0.5, z - 0.5, heights[1]],
        b: [x + 0.5, z + 0.5, heights[2]],
        neighbour: [0, 3],
      },
      {
        dc: 0,
        dr: 1,
        a: [x + 0.5, z + 0.5, heights[2]],
        b: [x - 0.5, z + 0.5, heights[3]],
        neighbour: [1, 0],
      },
      {
        dc: -1,
        dr: 0,
        a: [x - 0.5, z + 0.5, heights[3]],
        b: [x - 0.5, z - 0.5, heights[0]],
        neighbour: [2, 1],
      },
    ];
    for (const side of sides) {
      const neighbour = tiles[row + side.dr]?.[col + side.dc] ?? null;
      // Bridge fascia ends at the deck underside; it must not dam the river.
      const bridge = this.#isBridge(col, row);
      const lowA = Math.max(
        neighbour?.[side.neighbour[0]] ?? COLLISION_BASE_HEIGHT,
        bridge ? side.a[2] - BRIDGE_DECK_THICKNESS : COLLISION_BASE_HEIGHT,
      );
      const lowB = Math.max(
        neighbour?.[side.neighbour[1]] ?? COLLISION_BASE_HEIGHT,
        bridge ? side.b[2] - BRIDGE_DECK_THICKNESS : COLLISION_BASE_HEIGHT,
      );
      if (
        side.a[2] <= lowA + SURFACE_EPSILON &&
        side.b[2] <= lowB + SURFACE_EPSILON
      ) {
        continue;
      }
      this.#addTerrainQuad(
        positions,
        indices,
        this.#mapData.tileMeta?.[row]?.[col]?.terrainCutouts ?? [],
        [side.a[0], side.a[2], side.a[1]],
        [side.b[0], side.b[2], side.b[1]],
        [side.b[0], Math.min(side.b[2], lowB), side.b[1]],
        [side.a[0], Math.min(side.a[2], lowA), side.a[1]],
      );
    }
  }

  /**
   *
   * @param {number[]} positions
   * @param {number[]} indices
   * @param {Array<Array<number[]|null>>} tiles
   */
  #addSupplementalSurfaces(positions, indices, tiles) {
    if (!this.#collisionWorld) {
      return;
    }
    const half = SUPPLEMENTAL_SAMPLE_SIZE / 2;
    const minimumX = -(this.#mapData.cols - 1) / 2 - 0.5;
    const minimumZ = -(this.#mapData.rows - 1) / 2 - 0.5;
    const maximumX = -minimumX;
    const maximumZ = -minimumZ;
    for (
      let z = minimumZ + half;
      z < maximumZ;
      z += SUPPLEMENTAL_SAMPLE_SIZE
    ) {
      // Keep the quarter-tile sampling exactly as before; only coalesce the
      // resulting coplanar faces. A missing sample or height change ends a run.
      let runStart = minimumX;
      let runHeight = null;
      for (
        let x = minimumX + half;
        x <= maximumX + half;
        x += SUPPLEMENTAL_SAMPLE_SIZE
      ) {
        const height = x < maximumX ? this.#collisionWorld.physicsSurfaceHeightAt(
          x,
          z,
          half,
        ) : null;
        const col = Math.round(x + (this.#mapData.cols - 1) / 2);
        const row = Math.round(z + (this.#mapData.rows - 1) / 2);
        const terrain = tiles[row]?.[col];
        const terrainHeight = terrain ? Math.max(...terrain) : -Infinity;
        const nextHeight = Number.isFinite(height) && height > terrainHeight + SURFACE_EPSILON
          ? height : null;
        if (nextHeight === runHeight) {
          continue;
        }
        if (runHeight !== null) {
          this.#addQuad(
            positions,
            indices,
            [runStart, runHeight, z - half],
            [x - half, runHeight, z - half],
            [x - half, runHeight, z + half],
            [runStart, runHeight, z + half],
          );
        }
        runStart = x - half;
        runHeight = nextHeight;
      }
    }
  }

  /**
   *
   * @param {number[]} positions
   * @param {number[]} indices
   */
  #addOverpassDeck(positions, indices) {
    const overpass = this.#mapData.overpassData;
    if (!overpass?.crossing) {
      return;
    }
    const { col, row, width, depth } = overpass.crossing;
    const centerX = col + (width - 1) / 2 - (this.#mapData.cols - 1) / 2;
    const centerZ = row + (depth - 1) / 2 - (this.#mapData.rows - 1) / 2;
    const minimumX = centerX - width / 2;
    const maximumX = centerX + width / 2;
    const minimumZ = centerZ - depth / 2;
    const maximumZ = centerZ + depth / 2;
    const top = overpass.deckElevation;
    const bottom = top - (overpass.deckThickness ?? 0.24);
    const topCorners = [
      [minimumX, top, minimumZ],
      [maximumX, top, minimumZ],
      [maximumX, top, maximumZ],
      [minimumX, top, maximumZ],
    ];
    const bottomCorners = topCorners.map(/**
     *
     * @param {{"0": Array, "1": Array, "2": Array}} options
     * @param {Array} options."0"
     * @param {Array} options."1"
     * @param {Array} options."2"
     */
      ([x, , z]) => [x, bottom, z]);
    this.#addQuad(positions, indices, ...topCorners);
    this.#addQuad(positions, indices, ...bottomCorners.toReversed());
    for (let index = 0; index < topCorners.length; index += 1) {
      const nextIndex = (index + 1) % topCorners.length;
      this.#addQuad(
        positions,
        indices,
        topCorners[index],
        topCorners[nextIndex],
        bottomCorners[nextIndex],
        bottomCorners[index],
      );
    }
  }
  /**
   *
   * @param {number[]} positions
   * @param {number[]} indices
   * @param {number} a
   * @param {number} b
   * @param {number} c
   * @param {number} d
   */
  #addQuad(positions, indices, a, b, c, d) {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }
  /**
   * @param {number[]} positions
   * @param {number[]} indices
   * @param {Array} cuts
   * @param {number[]} a
   * @param {number[]} b
   * @param {number[]} c
   * @param {number[]} d
   */
  #addTerrainQuad(positions, indices, cuts, a, b, c, d) {
    for (const polygon of subtractTerrainCutouts([a, b, c, d], cuts)) {
      const start = positions.length / 3;
      for (const point of polygon) {
        positions.push(...point);
      }
      for (let index = 1; index + 1 < polygon.length; index++) {
        indices.push(start, start + index + 1, start + index);
      }
    }
  }

  #from() {
    return Array(this.#mapData.cols).fill(null);
  }
}
