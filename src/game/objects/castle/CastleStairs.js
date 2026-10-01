import { createCastleStairFlight } from "./CastleStairFlight.js";
import stairModuleModelUrl from "../../models/castle/stairs/castle-stair-module.glb?url";

const STONE_MATERIAL_NAMES = [
  "castleStoneDark",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneMid",
  "castleStoneDark",
];
const STAIR_MODULE_RUN_BLOCKS = 2;

/**
 * Builds variable-size flights from a reusable imported stone stair module.
 */
export class CastleStairs {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return stairModuleModelUrl;
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {Array<{side: string, offset: number, width: number, approachElevation?: number}>}
   */
  #doors;
  /**
   *
    * @type {number}
   */
  #cubeSize;
  /**
   *
    * @type {string}
   */
  #modelLibrary;
  /**
   *
    * @type {Map<string, import("playcanvas").Material>}
   */
  #materials;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {Array<{side: string, vertical: boolean, outerEdge: number, acrossStart: number, acrossEnd: number, approachElevation: number, rise: number, run: number, riseBlocks: number, stepRun: number, stepHeight: number}>}
   */
  #surfaces = [];
  /**
   *
    * @type {Array<import("playcanvas").VertexBuffer>}
   */
  #vertexBuffers = [];

  /**
   *
   * @param {{pc: typeof import("playcanvas"), position: {x: number, y: number, z: number}, doors: Array<{side: string, offset: number, width: number, approachElevation?: number}>, cubeSize: number, modelLibrary: string, materials: Map<string, import("playcanvas").Material>}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {{x: number, y: number, z: number}} options.position
   * @param {Array<{side: string, offset: number, width: number, approachElevation?: number}>} options.doors
   * @param {number} options.cubeSize
   * @param {string} options.modelLibrary
   * @param {Map<string, import("playcanvas").Material>} options.materials
   */
  constructor({
    pc,
    position,
    doors = [],
    cubeSize,
    modelLibrary,
    materials,
  }) {

    this.#pc = pc;

    this.#position = position;

    this.#doors = doors;

    this.#cubeSize = cubeSize;

    this.#modelLibrary = modelLibrary;

    this.#materials = materials;

    this.#entity = new pc.Entity("Castle stone stairs");

    this.#render();
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
  surfaceHeightAt(x, z) {
    for (const surface of this.#surfaces) {
      const across = surface.vertical ? z : x;
      if (across < surface.acrossStart || across > surface.acrossEnd) {
        continue;
      }

      const inward = this.#inwardAt(surface, x, z);
      if (inward < 0 || inward > surface.run) {
        continue;
      }

      return this.#heightAt(surface, inward);
    }
    return null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  blocksMovementAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    for (const surface of this.#surfaces) {
      const across = surface.vertical ? z : x;
      const inward = this.#inwardAt(surface, x, z);
      const nearestAcross = Math.max(
        surface.acrossStart,
        Math.min(surface.acrossEnd, across),
      );
      const nearestInward = Math.max(0, Math.min(surface.run, inward));
      const distanceSquared =
        (across - nearestAcross) ** 2 + (inward - nearestInward) ** 2;
      if (distanceSquared > radius * radius) {
        continue;
      }
      // Sample the nearest tread. Sampling the far edge of the body radius
      // would turn an ordinary ascending footstep into a collision with a wall.
      const height = this.#heightAt(surface, nearestInward);
      if (height > elevation + stepClearance + 0.000001) {
        return true;
      }
    }
    return false;
  }

  /**
   *
   * @param {{side: string, vertical: boolean, outerEdge: number, acrossStart: number, acrossEnd: number, approachElevation: number, rise: number, run: number, riseBlocks: number, stepRun: number, stepHeight: number}} surface
   * @param {number} x
   * @param {number} z
   */
  #inwardAt(surface, x, z) {
    if (surface.side === "WEST") {
      return x - surface.outerEdge;
    }
    if (surface.side === "EAST") {
      return surface.outerEdge - x;
    }
    if (surface.side === "NORTH") {
      return z - surface.outerEdge;
    }
    return surface.outerEdge - z;
  }

  /**
   *
   * @param {{side: string, vertical: boolean, outerEdge: number, acrossStart: number, acrossEnd: number, approachElevation: number, rise: number, run: number, riseBlocks: number, stepRun: number, stepHeight: number}} surface
   * @param {number} inward
   */
  #heightAt(surface, inward) {
    const level = Math.min(
      surface.riseBlocks - 1,
      Math.floor(Math.max(0, inward) / surface.stepRun),
    );
    return surface.approachElevation + (level + 1) * surface.stepHeight;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
    this.#surfaces = [];
  }

  #render() {
    if (!this.#position || !this.#doors.length || !this.#cubeSize) {
      return;
    }

    const batches = new Map();
    const blocksPerTile = 1 / this.#cubeSize;
    for (const door of this.#doors) {
      const flight = createCastleStairFlight(this.#position, door, this.#cubeSize);
      if (!flight) continue;
      const { approachElevation, riseBlocks, stepHeight } = flight;
      const widthBlocks = Math.round(flight.width * blocksPerTile);
      const offsetBlocks = Math.round(flight.offset * blocksPerTile);
      this.#surfaces.push(flight);

      for (let level = 0; level < riseBlocks; level += 1) {
        const distanceBlocks =
          (riseBlocks - level) * STAIR_MODULE_RUN_BLOCKS -
          STAIR_MODULE_RUN_BLOCKS / 2;
        for (let horizontal = 0; horizontal < widthBlocks; horizontal += 1) {
          for (let layer = 0; layer <= level; layer += 1) {
            const acrossBlocks = offsetBlocks + horizontal;
            const position = this.#modulePosition(
              door.side,
              distanceBlocks,
              acrossBlocks,
              approachElevation,
              layer,
              stepHeight,
            );
            if (!position) continue;
            this.#addModuleMatrix(
              batches,
              this.#materialFor(distanceBlocks, acrossBlocks, layer),
              door.side,
              position,
              stepHeight,
            );
          }
        }
      }
    }

    this.#createInstancedBatches(batches);
  }

  /**
   *
   * @param {string} side
   * @param {number} distanceBlocks
   * @param {number} acrossBlocks
   * @param {number} approachElevation
   * @param {number} layer
   * @param {number} stepHeight
   */
  #modulePosition(
    side,
    distanceBlocks,
    acrossBlocks,
    approachElevation,
    layer,
    stepHeight,
  ) {
    const distance = distanceBlocks * this.#cubeSize;
    const across = (acrossBlocks + 0.5) * this.#cubeSize;
    const y = approachElevation + (layer + 0.5) * stepHeight;
    const left = this.#position.x;
    const right = left + this.#position.width;
    const top = this.#position.z;
    const bottom = top + this.#position.depth;

    const positions = {
      WEST: { x: left - distance, y, z: top + across },
      EAST: { x: right + distance, y, z: top + across },
      NORTH: { x: left + across, y, z: top - distance },
      SOUTH: { x: left + across, y, z: bottom + distance },
    };
    return positions[side] ?? null;
  }

  /**
   *
   * @param {number} distanceBlocks
   * @param {number} acrossBlocks
   * @param {number} layer
   */
  #materialFor(distanceBlocks, acrossBlocks, layer) {
    const hash =
      Math.imul(distanceBlocks + 11, 73856093) ^
      Math.imul(acrossBlocks + 17, 19349663) ^
      Math.imul(layer + 23, 83492791);
    return STONE_MATERIAL_NAMES[(hash >>> 0) % STONE_MATERIAL_NAMES.length];
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   * @param {string} material
   * @param {string} side
   * @param {{x: number, y: number, z: number}} position
   * @param {number} stepHeight
   */
  #addModuleMatrix(batches, material, side, position, stepHeight) {
    const matrix = new this.#pc.Mat4();
    const rotation = new this.#pc.Quat();
    rotation.setFromEulerAngles(
      0,
      side === "WEST" || side === "EAST" ? 90 : 0,
      0,
    );
    matrix.setTRS(
      new this.#pc.Vec3(position.x, position.y, position.z),
      rotation,
      new this.#pc.Vec3(this.#cubeSize, stepHeight, this.#cubeSize),
    );
    const matrices = batches.get(material) ?? [];
    for (const value of matrix.data) matrices.push(value);
    batches.set(material, matrices);
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   */
  #createInstancedBatches(batches) {
    for (const [materialName, matrices] of batches.entries()) {
      const batch = this.#modelLibrary.instantiateMergedBatch(
        CastleStairs.modelUrl,
        matrices,
        {
          name: `${materialName} stair modules`,
          material: this.#materials.get(materialName),
        },
      );
      if (!batch) continue;
      this.#vertexBuffers.push(batch.vertexBuffer);
      this.#entity.addChild(batch.entity);
    }
  }
}
