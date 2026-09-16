import stairModuleModelUrl from "../../models/castle/stairs/castle-stair-module.glb?url";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";

const STAIR_BLOCK_SIZE = 0.25;
const STAIR_MODULE_RUN_BLOCKS = 2;

/** Replaces an overpass ramp surface with castle-style sandstone steps. */
export class OverpassStairs {
  static get modelUrl() {
    return stairModuleModelUrl;
  }

  #pc;
  #overpass;
  #cols;
  #rows;
  #modelLibrary;
  #materials;
  #root;

  constructor({ pc, overpass, cols, rows, modelLibrary, materials, root }) {
    this.#pc = pc;
    this.#overpass = overpass;
    this.#cols = cols;
    this.#rows = rows;
    this.#modelLibrary = modelLibrary;
    this.#materials = materials;
    this.#root = root;
  }

  build() {
    if (!this.#overpass?.stairApproach) {
      return [];
    }

    const matrices = [];
    const flights = new Map();
    for (const cell of this.#overpass.slopeCells) {
      const flight = flights.get(cell.riseDirection) ?? [];
      flight.push(cell);
      flights.set(cell.riseDirection, flight);
    }
    for (const [riseDirection, cells] of flights.entries()) {
      this.#addFlight(matrices, riseDirection, cells);
    }
    if (!matrices.length) {
      return [];
    }

    const batch = this.#modelLibrary.instantiateMergedBatch(
      OverpassStairs.modelUrl,
      matrices,
      {
        name: "Overpass sandstone stairs",
        material: this.#materials.get("path"),
      },
    );
    if (!batch) {
      return [];
    }
    this.#root.addChild(batch.entity);
    return [batch.vertexBuffer];
  }

  #addFlight(matrices, riseDirection, cells) {
    if (
      riseDirection !== SLOPE_DIRECTION.NORTH &&
      riseDirection !== SLOPE_DIRECTION.SOUTH
    ) {
      return;
    }

    const minCol = Math.min(...cells.map((cell) => cell.col));
    const maxCol = Math.max(...cells.map((cell) => cell.col));
    const minRow = Math.min(...cells.map((cell) => cell.row));
    const maxRow = Math.max(...cells.map((cell) => cell.row));
    const baseElevation = Math.min(...cells.map((cell) => cell.lowHeight));
    const topElevation = Math.max(...cells.map((cell) => cell.highHeight));
    const riseBlocks = Math.round(
      (topElevation - baseElevation) / STAIR_BLOCK_SIZE,
    );
    const widthBlocks = Math.round(
      (maxCol - minCol + 1) / STAIR_BLOCK_SIZE,
    );
    const highBoundary =
      riseDirection === SLOPE_DIRECTION.SOUTH
        ? maxRow + 0.5
        : minRow - 0.5;
    const outwardSign =
      riseDirection === SLOPE_DIRECTION.SOUTH ? -1 : 1;

    for (let level = 0; level < riseBlocks; level += 1) {
      const distanceBlocks =
        (riseBlocks - level) * STAIR_MODULE_RUN_BLOCKS -
        STAIR_MODULE_RUN_BLOCKS / 2;
      const z =
        highBoundary + outwardSign * distanceBlocks * STAIR_BLOCK_SIZE;
      for (let horizontal = 0; horizontal < widthBlocks; horizontal += 1) {
        const x =
          minCol - 0.5 + (horizontal + 0.5) * STAIR_BLOCK_SIZE;
        for (let layer = 0; layer <= level; layer += 1) {
          this.#addMatrix(matrices, {
            x: x - (this.#cols - 1) / 2,
            y: baseElevation + (layer + 0.5) * STAIR_BLOCK_SIZE,
            z: z - (this.#rows - 1) / 2,
          });
        }
      }
    }
  }

  #addMatrix(matrices, position) {
    const matrix = new this.#pc.Mat4();
    matrix.setTRS(
      new this.#pc.Vec3(position.x, position.y, position.z),
      this.#pc.Quat.IDENTITY,
      new this.#pc.Vec3(
        STAIR_BLOCK_SIZE,
        STAIR_BLOCK_SIZE,
        STAIR_BLOCK_SIZE,
      ),
    );
    for (const value of matrix.data) {
      matrices.push(value);
    }
  }
}
