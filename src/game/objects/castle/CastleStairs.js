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

/** Builds variable-size flights from a reusable imported stone stair module. */
export class CastleStairs {
  static get modelUrl() {
    return stairModuleModelUrl;
  }

  #pc;
  #position;
  #doors;
  #cubeSize;
  #modelLibrary;
  #materials;
  #entity;
  #surfaces = [];
  #vertexBuffers = [];

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

      return (
        surface.approachElevation +
        (inward / surface.run) * surface.rise
      );
    }
    return null;
  }

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
      // Sample the nearest ramp point. Sampling the far edge of the body radius
      // would turn an ordinary ascending footstep into a collision with a wall.
      const height = surface.approachElevation +
        (nearestInward / surface.run) * surface.rise;
      if (height > elevation + stepClearance + 0.000001) {
        return true;
      }
    }
    return false;
  }

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
    const baseY = Math.max(0, this.#position.elevation ?? 0);
    const blocksPerTile = 1 / this.#cubeSize;

    for (const door of this.#doors) {
      const approachElevation = Number.isFinite(door.approachElevation)
        ? door.approachElevation
        : baseY;
      const rise = Math.max(0, baseY - approachElevation);
      const riseBlocks = Math.max(
        0,
        Math.ceil(rise / this.#cubeSize - 0.000001),
      );
      const stepHeight = riseBlocks > 0 ? rise / riseBlocks : this.#cubeSize;
      const widthBlocks = Math.round(door.width * blocksPerTile);
      const offsetBlocks = Math.round(door.offset * blocksPerTile);
      this.#addSurface(door, approachElevation, riseBlocks, rise);

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

  #addSurface(door, approachElevation, riseBlocks, rise) {
    if (riseBlocks <= 0) {
      return;
    }
    const run = riseBlocks * STAIR_MODULE_RUN_BLOCKS * this.#cubeSize;
    const left = this.#position.x;
    const right = left + this.#position.width;
    const top = this.#position.z;
    const bottom = top + this.#position.depth;
    const vertical = door.side === "WEST" || door.side === "EAST";
    const acrossOrigin = vertical ? top : left;
    const boundaryEdge = {
      WEST: left,
      EAST: right,
      NORTH: top,
      SOUTH: bottom,
    }[door.side];
    const outwardSign =
      door.side === "WEST" || door.side === "NORTH" ? -1 : 1;
    if (!Number.isFinite(boundaryEdge)) {
      return;
    }

    this.#surfaces.push({
      side: door.side,
      vertical,
      outerEdge: boundaryEdge + outwardSign * run,
      acrossStart: acrossOrigin + door.offset,
      acrossEnd: acrossOrigin + door.offset + door.width,
      approachElevation,
      rise,
      run,
    });
  }

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

  #materialFor(distanceBlocks, acrossBlocks, layer) {
    const hash =
      Math.imul(distanceBlocks + 11, 73856093) ^
      Math.imul(acrossBlocks + 17, 19349663) ^
      Math.imul(layer + 23, 83492791);
    return STONE_MATERIAL_NAMES[(hash >>> 0) % STONE_MATERIAL_NAMES.length];
  }

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
