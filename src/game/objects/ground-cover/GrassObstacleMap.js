import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";

const SAMPLES_PER_TILE = 12;
const OUTER_BEND_SAMPLES = 2;
const INNER_DIRECTION_SAMPLES = 6;

export class GrassObstacleMap {
  #texture;
  #mapData;
  #width;
  #height;
  #weights;
  #field;
  #sourceCovers;

  constructor({ pc, device, mapData }) {
    this.#mapData = mapData;
    this.#width = mapData.cols * SAMPLES_PER_TILE;
    this.#height = mapData.rows * SAMPLES_PER_TILE;
    this.#weights = new Uint8Array(this.#width * this.#height);
    this.#field = new Uint8Array(this.#width * this.#height * 4);
    this.#sourceCovers = new Map(
      (this.#mapData.riverData ?? []).flatMap(({ cells }) =>
        cells[0]
          ? [[cells[0].col + "," + cells[0].row, cells[0].terrainHeight]]
          : [],
      ),
    );
    this.#texture = new pc.Texture(device, {
      name: "Grass surface obstruction field",
      width: this.#width,
      height: this.#height,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
  }

  get texture() {
    return this.#texture;
  }

  apply(material) {
    material.setParameter("uGrassObstacleMap", this.#texture);
    material.setParameter("uGrassObstacleMapSize", [
      this.#mapData.cols,
      this.#mapData.rows,
    ]);
  }

  refresh(weightAt = () => 0, tile = null) {
    const weightBounds = this.#weightBounds(tile);
    this.#updateWeights(weightAt, weightBounds);
    this.#updateField(
      this.#expandBounds(weightBounds, INNER_DIRECTION_SAMPLES),
    );
    this.#texture.lock().set(this.#field);
    this.#texture.unlock();
  }

  destroy() {
    this.#texture.destroy();
    this.#texture = null;
    this.#mapData = null;
    this.#weights = null;
    this.#field = null;
    this.#sourceCovers.clear();
    this.#sourceCovers = null;
  }

  #weightBounds(tile) {
    if (!Number.isFinite(tile?.col) || !Number.isFinite(tile?.row)) {
      return {
        minimumX: 0,
        maximumX: this.#width,
        minimumZ: 0,
        maximumZ: this.#height,
      };
    }
    const tilePadding = 1;
    return {
      minimumX: Math.max(0, (tile.col - tilePadding) * SAMPLES_PER_TILE),
      maximumX: Math.min(
        this.#width,
        (tile.col + tilePadding + 1) * SAMPLES_PER_TILE,
      ),
      minimumZ: Math.max(0, (tile.row - tilePadding) * SAMPLES_PER_TILE),
      maximumZ: Math.min(
        this.#height,
        (tile.row + tilePadding + 1) * SAMPLES_PER_TILE,
      ),
    };
  }

  #expandBounds(bounds, padding) {
    return {
      minimumX: Math.max(0, bounds.minimumX - padding),
      maximumX: Math.min(this.#width, bounds.maximumX + padding),
      minimumZ: Math.max(0, bounds.minimumZ - padding),
      maximumZ: Math.min(this.#height, bounds.maximumZ + padding),
    };
  }

  #updateWeights(weightAt, bounds) {
    for (
      let pixelZ = bounds.minimumZ;
      pixelZ < bounds.maximumZ;
      pixelZ += 1
    ) {
      const row = Math.floor(pixelZ / SAMPLES_PER_TILE);
      for (
        let pixelX = bounds.minimumX;
        pixelX < bounds.maximumX;
        pixelX += 1
      ) {
        const col = Math.floor(pixelX / SAMPLES_PER_TILE);
        const offset = pixelZ * this.#width + pixelX;
        this.#weights[offset] = 0;
        const sourceHeight = this.#sourceCovers.get(col + "," + row);
        const surfaceHeight =
          sourceHeight ?? this.#mapData.heightmap[row][col];
        const metadata = this.#mapData.tileMeta?.[row]?.[col];
        if (
          (this.#mapData.grid[row][col] !== TileType.GRASS &&
            sourceHeight === undefined) ||
          surfaceHeight <= 0 ||
          metadata?.shape === TILE_SHAPE.SLOPE ||
          metadata?.renderMode === "BRIDGE"
        ) {
          continue;
        }
        const worldX =
          (pixelX + 0.5) / SAMPLES_PER_TILE -
          0.5 -
          (this.#mapData.cols - 1) / 2;
        const worldZ =
          (pixelZ + 0.5) / SAMPLES_PER_TILE -
          0.5 -
          (this.#mapData.rows - 1) / 2;
        const rootY = surfaceHeight + GRASS_SURFACE_LIFT - 0.002;
        this.#weights[offset] = Math.round(
          Math.max(0, Math.min(1, weightAt(worldX, rootY, worldZ))) * 255,
        );
      }
    }
  }

  #updateField(bounds) {
    for (let z = bounds.minimumZ; z < bounds.maximumZ; z += 1) {
      for (let x = bounds.minimumX; x < bounds.maximumX; x += 1) {
        const sourceOffset = z * this.#width + x;
        const fieldOffset = sourceOffset * 4;
        this.#field[fieldOffset] = 128;
        this.#field[fieldOffset + 1] = 128;
        this.#field[fieldOffset + 2] = 0;
        this.#field[fieldOffset + 3] = 0;
        const occupied = this.#weights[sourceOffset] > 0;
        const nearest = this.#nearestOpposite(
          this.#weights,
          x,
          z,
          occupied,
          occupied ? INNER_DIRECTION_SAMPLES : OUTER_BEND_SAMPLES,
        );
        if (!occupied && !nearest) {
          continue;
        }
        const weight = occupied
          ? this.#weights[sourceOffset] / 255
          : this.#weights[nearest.z * this.#width + nearest.x] / 255;
        const outerFalloff = nearest
          ? 1 - nearest.distance / (OUTER_BEND_SAMPLES + 1)
          : 0;
        const pressure = occupied ? weight : outerFalloff * weight;
        this.#field[fieldOffset + 2] = Math.round(
          Math.max(0, Math.min(1, pressure)) * 255,
        );
        // Alpha is exact occupancy, while blue may extend beyond the object
        // to bend neighboring blades. Keeping these separate prevents the
        // renderer from clipping a halo around a solid footprint.
        this.#field[fieldOffset + 3] = this.#weights[sourceOffset];
        if (!nearest || nearest.distance <= 0) {
          continue;
        }
        const directionX = occupied ? nearest.x - x : x - nearest.x;
        const directionZ = occupied ? nearest.z - z : z - nearest.z;
        this.#field[fieldOffset] = Math.round(
          128 + directionX / nearest.distance * 127,
        );
        this.#field[fieldOffset + 1] = Math.round(
          128 + directionZ / nearest.distance * 127,
        );
      }
    }
  }

  #nearestOpposite(weights, x, z, occupied, radius) {
    let nearest = null;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx === 0 && dz === 0) {
          continue;
        }
        const sampleX = x + dx;
        const sampleZ = z + dz;
        if (
          sampleX < 0 ||
          sampleZ < 0 ||
          sampleX >= this.#width ||
          sampleZ >= this.#height
        ) {
          continue;
        }
        const sampleOccupied =
          weights[sampleZ * this.#width + sampleX] > 0;
        if (sampleOccupied === occupied) {
          continue;
        }
        const distance = Math.hypot(dx, dz);
        if (distance > radius || (nearest && distance >= nearest.distance)) {
          continue;
        }
        nearest = { x: sampleX, z: sampleZ, distance };
      }
    }
    return nearest;
  }
}
