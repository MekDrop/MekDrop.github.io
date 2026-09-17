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

  constructor({ pc, device, mapData }) {
    this.#mapData = mapData;
    this.#width = mapData.cols * SAMPLES_PER_TILE;
    this.#height = mapData.rows * SAMPLES_PER_TILE;
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

  refresh(weightAt = () => 0) {
    const weights = this.#createWeights(weightAt);
    const field = this.#createField(weights);
    this.#texture.lock().set(field);
    this.#texture.unlock();
  }

  destroy() {
    this.#texture.destroy();
    this.#texture = null;
    this.#mapData = null;
  }

  #createWeights(weightAt) {
    const weights = new Uint8Array(this.#width * this.#height);
    const sourceCovers = new Map(
      (this.#mapData.riverData ?? []).flatMap(({ cells }) =>
        cells[0]
          ? [[cells[0].col + "," + cells[0].row, cells[0].terrainHeight]]
          : [],
      ),
    );
    for (let pixelZ = 0; pixelZ < this.#height; pixelZ += 1) {
      const row = Math.floor(pixelZ / SAMPLES_PER_TILE);
      for (let pixelX = 0; pixelX < this.#width; pixelX += 1) {
        const col = Math.floor(pixelX / SAMPLES_PER_TILE);
        const sourceHeight = sourceCovers.get(col + "," + row);
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
        weights[pixelZ * this.#width + pixelX] = Math.round(
          Math.max(0, Math.min(1, weightAt(worldX, rootY, worldZ))) * 255,
        );
      }
    }
    return weights;
  }

  #createField(weights) {
    const field = new Uint8Array(this.#width * this.#height * 4);
    for (let z = 0; z < this.#height; z += 1) {
      for (let x = 0; x < this.#width; x += 1) {
        const sourceOffset = z * this.#width + x;
        const fieldOffset = sourceOffset * 4;
        field[fieldOffset] = 128;
        field[fieldOffset + 1] = 128;
        const occupied = weights[sourceOffset] > 0;
        const nearest = this.#nearestOpposite(
          weights,
          x,
          z,
          occupied,
          occupied ? INNER_DIRECTION_SAMPLES : OUTER_BEND_SAMPLES,
        );
        if (!occupied && !nearest) {
          continue;
        }
        const weight = occupied
          ? weights[sourceOffset] / 255
          : weights[nearest.z * this.#width + nearest.x] / 255;
        const outerFalloff = nearest
          ? 1 - nearest.distance / (OUTER_BEND_SAMPLES + 1)
          : 0;
        const pressure = occupied ? weight : outerFalloff * weight;
        field[fieldOffset + 2] = Math.round(
          Math.max(0, Math.min(1, pressure)) * 255,
        );
        // Alpha is exact occupancy, while blue may extend beyond the object
        // to bend neighboring blades. Keeping these separate prevents the
        // renderer from clipping a halo around a solid footprint.
        field[fieldOffset + 3] = weights[sourceOffset];
        if (!nearest || nearest.distance <= 0) {
          continue;
        }
        const directionX = occupied ? nearest.x - x : x - nearest.x;
        const directionZ = occupied ? nearest.z - z : z - nearest.z;
        field[fieldOffset] = Math.round(
          128 + directionX / nearest.distance * 127,
        );
        field[fieldOffset + 1] = Math.round(
          128 + directionZ / nearest.distance * 127,
        );
      }
    }
    return field;
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
