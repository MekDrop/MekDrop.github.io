import { TileType } from "../../MapGenerator.js";

const CASTLE_SHADOW_LENGTH = 7;
const CASTLE_SHADOW_RADIUS = 0.78;
const CASTLE_BLOCKAGE = 0.98;
const TREE_SHADOW_LENGTH = 4.5;
const TREE_SHADOW_RADIUS = 0.65;
const TREE_BLOCKAGE = 0.74;
const BUSH_SHADOW_LENGTH = 3;
const BUSH_SHADOW_RADIUS = 0.5;
const BUSH_BLOCKAGE = 0.56;
const SHADOW_SPREAD = 0.12;
const MINIMUM_EXPOSURE = 0.04;
const DIRECTION_REFRESH_DOT = 0.9999;

/** Builds a smooth, direction-aware shelter field for the grass shader. */
export class GrassWindMap {
  #texture;
  #mapData;
  #blockers = [];
  #lastDirection = null;

  constructor({ pc, device, mapData }) {
    this.#mapData = mapData;
    this.#texture = new pc.Texture(device, {
      name: "Grass wind exposure field",
      width: mapData.cols,
      height: mapData.rows,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    this.#indexBlockers();
  }

  get texture() {
    return this.#texture;
  }

  apply(material) {
    material.setParameter("uGrassWindMap", this.#texture);
    material.setParameter("uGrassWindMapSize", [
      this.#mapData.cols,
      this.#mapData.rows,
    ]);
  }

  refresh(direction) {
    const length = Math.hypot(direction?.x ?? 0, direction?.z ?? 0);
    if (length <= 0.000001) {
      return;
    }
    const normalized = {
      x: direction.x / length,
      z: direction.z / length,
    };
    if (
      this.#lastDirection &&
      this.#lastDirection.x * normalized.x +
        this.#lastDirection.z * normalized.z >=
        DIRECTION_REFRESH_DOT
    ) {
      return;
    }
    this.#lastDirection = normalized;

    const field = new Uint8Array(
      this.#mapData.cols * this.#mapData.rows * 4,
    );
    for (let row = 0; row < this.#mapData.rows; row += 1) {
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        const exposure = this.#exposureAt(col, row, normalized);
        const value = Math.round(exposure * 255);
        const offset = (row * this.#mapData.cols + col) * 4;
        field[offset] = value;
        field[offset + 1] = value;
        field[offset + 2] = value;
        field[offset + 3] = 255;
      }
    }
    this.#texture.lock().set(field);
    this.#texture.unlock();
  }

  destroy() {
    this.#texture?.destroy();
    this.#texture = null;
    this.#mapData = null;
    this.#blockers = [];
    this.#lastDirection = null;
  }

  #indexBlockers() {
    for (let row = 0; row < this.#mapData.rows; row += 1) {
      for (let col = 0; col < this.#mapData.cols; col += 1) {
        const type = this.#mapData.grid[row][col];
        if (
          type !== TileType.CASTLE_WALL &&
          type !== TileType.CASTLE_TOWER &&
          type !== TileType.ENTRY
        ) {
          continue;
        }
        this.#blockers.push({
          col,
          row,
          radius: CASTLE_SHADOW_RADIUS,
          shadowLength: CASTLE_SHADOW_LENGTH,
          blockage: CASTLE_BLOCKAGE,
        });
      }
    }

    for (const vegetation of this.#mapData.vegetationData ?? []) {
      const tree = vegetation.kind === "tree";
      this.#blockers.push({
        col: vegetation.col,
        row: vegetation.row,
        radius: tree ? TREE_SHADOW_RADIUS : BUSH_SHADOW_RADIUS,
        shadowLength: tree ? TREE_SHADOW_LENGTH : BUSH_SHADOW_LENGTH,
        blockage: tree ? TREE_BLOCKAGE : BUSH_BLOCKAGE,
      });
    }
  }

  #exposureAt(col, row, direction) {
    let exposure = 1;
    const crossX = -direction.z;
    const crossZ = direction.x;
    for (const blocker of this.#blockers) {
      const deltaX = col - blocker.col;
      const deltaZ = row - blocker.row;
      const downstream =
        deltaX * direction.x + deltaZ * direction.z;
      if (downstream < 0 || downstream > blocker.shadowLength) {
        continue;
      }
      const across = Math.abs(deltaX * crossX + deltaZ * crossZ);
      const shadowWidth =
        blocker.radius + downstream * SHADOW_SPREAD;
      if (across > shadowWidth) {
        continue;
      }
      const distanceFade = 1 - downstream / blocker.shadowLength;
      const centerFade = 1 - across / shadowWidth;
      const occlusion =
        blocker.blockage *
        distanceFade *
        (0.65 + centerFade * 0.35);
      exposure = Math.min(exposure, 1 - occlusion);
    }
    return Math.max(MINIMUM_EXPOSURE, exposure);
  }
}
