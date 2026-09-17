import { TileType } from "../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { SLOPE_DIRECTION } from "../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../enum/TileShape.js";

const COLLISION_BASE_HEIGHT = -16;
const SUPPLEMENTAL_SAMPLE_SIZE = 0.25;
const SURFACE_EPSILON = 0.01;
const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
const GRASS_SURFACE_TILES = new Set([TileType.GRASS]);

/** Builds the static walkable world consumed by PlayCanvas' physics backend. */
export class HeroPhysicsTerrain {
  #pc;
  #app;
  #mapData;
  #collisionWorld;
  #entity;
  #mesh = null;
  #model = null;
  #material = null;
  #sourceCovers = new Map();

  constructor({ pc, app, mapData, collisionWorld }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#collisionWorld = collisionWorld;
    this.#entity = new pc.Entity("Hero physics terrain");
    this.#entity.tags.add("hero-physics-surface");
    this.#indexSourceCovers();
    this.refresh();
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
    this.#material.name = "Hero physics terrain material";
    this.#material.update();
    const node = new this.#pc.GraphNode("Hero physics terrain mesh");
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
    this.#entity?.destroy();
    this.#mesh?.destroy();
    this.#material?.destroy();
    this.#entity = null;
    this.#mesh = null;
    this.#model = null;
    this.#material = null;
    this.#sourceCovers.clear();
  }

  #indexSourceCovers() {
    for (const river of this.#mapData.riverData ?? []) {
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
    const tiles = Array.from({ length: this.#mapData.rows }, () =>
      Array(this.#mapData.cols).fill(null),
    );
    for (let row = 0; row < this.#mapData.rows; row += 1) {
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        tiles[row][col] = this.#tileSurface(col, row);
      }
    }

    for (let row = 0; row < this.#mapData.rows; row += 1) {
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        const surface = tiles[row][col];
        if (!surface) {
          continue;
        }
        this.#addTileTop(positions, indices, col, row, surface);
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
    return { positions, indices };
  }

  #tileSurface(col, row) {
    const type = this.#mapData.grid[row][col];
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

  #addTileTop(positions, indices, col, row, heights) {
    const x = col - (this.#mapData.cols - 1) / 2;
    const z = row - (this.#mapData.rows - 1) / 2;
    this.#addQuad(
      positions,
      indices,
      [x - 0.5, heights[0], z - 0.5],
      [x + 0.5, heights[1], z - 0.5],
      [x + 0.5, heights[2], z + 0.5],
      [x - 0.5, heights[3], z + 0.5],
    );
  }

  #addExposedTileSides(positions, indices, tiles, col, row, heights) {
    const x = col - (this.#mapData.cols - 1) / 2;
    const z = row - (this.#mapData.rows - 1) / 2;
    const sides = [
      { dc: 0, dr: -1, a: [x - 0.5, z - 0.5, heights[0]], b: [x + 0.5, z - 0.5, heights[1]], neighbour: [3, 2] },
      { dc: 1, dr: 0, a: [x + 0.5, z - 0.5, heights[1]], b: [x + 0.5, z + 0.5, heights[2]], neighbour: [0, 3] },
      { dc: 0, dr: 1, a: [x + 0.5, z + 0.5, heights[2]], b: [x - 0.5, z + 0.5, heights[3]], neighbour: [1, 0] },
      { dc: -1, dr: 0, a: [x - 0.5, z + 0.5, heights[3]], b: [x - 0.5, z - 0.5, heights[0]], neighbour: [2, 1] },
    ];
    for (const side of sides) {
      const neighbour = tiles[row + side.dr]?.[col + side.dc] ?? null;
      const lowA = neighbour?.[side.neighbour[0]] ?? COLLISION_BASE_HEIGHT;
      const lowB = neighbour?.[side.neighbour[1]] ?? COLLISION_BASE_HEIGHT;
      if (
        side.a[2] <= lowA + SURFACE_EPSILON &&
        side.b[2] <= lowB + SURFACE_EPSILON
      ) {
        continue;
      }
      this.#addQuad(
        positions,
        indices,
        [side.a[0], side.a[2], side.a[1]],
        [side.b[0], side.b[2], side.b[1]],
        [side.b[0], Math.min(side.b[2], lowB), side.b[1]],
        [side.a[0], Math.min(side.a[2], lowA), side.a[1]],
      );
    }
  }

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
      for (
        let x = minimumX + half;
        x < maximumX;
        x += SUPPLEMENTAL_SAMPLE_SIZE
      ) {
        const height = this.#collisionWorld.surfaceHeightAt(x, z, half);
        if (!Number.isFinite(height)) {
          continue;
        }
        const col = Math.round(x + (this.#mapData.cols - 1) / 2);
        const row = Math.round(z + (this.#mapData.rows - 1) / 2);
        const terrain = tiles[row]?.[col];
        const terrainHeight = terrain ? Math.max(...terrain) : -Infinity;
        if (height <= terrainHeight + SURFACE_EPSILON) {
          continue;
        }
        this.#addQuad(
          positions,
          indices,
          [x - half, height, z - half],
          [x + half, height, z - half],
          [x + half, height, z + half],
          [x - half, height, z + half],
        );
      }
    }
  }

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
    const bottomCorners = topCorners.map(([x, , z]) => [x, bottom, z]);
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
  #addQuad(positions, indices, a, b, c, d) {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }
}
