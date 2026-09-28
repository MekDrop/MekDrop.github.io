import { CASTLE_BOUNDARY } from "../../enum/CastleBoundary.js";
import {
  CASTLE_BLOCK_SIZE,
  CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
  CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS,
} from "./CastleGenerationConfig.js";
import { isCastleUpperFloorRoomVoid } from "./CastleGeometry.js";

export class CastleBuildPlanWriter {
  #layout;
  #occupied = new Set();
  #groundCollisionKeys = new Set();

  constructor(context) {
    this.#layout = context.layout;
    context.geometry = {
      boxes: [],
      decorations: {
        flames: [],
        banners: [],
        flags: [],
        roofs: [],
      },
      collision: {
        groundColumns: [],
        cameraBlocks: [],
      },
    };
    this.geometry = context.geometry;
  }

  openingAt(boundary, horizontalBlock, blockY) {
    const opening = this.#layout.openings.find(
      (candidate) =>
        candidate.boundary === boundary &&
        horizontalBlock >= candidate.start &&
        horizontalBlock < candidate.end,
    );
    return Boolean(opening) && blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
  }

  addBlock(blockU, blockY, blockV, role = "stone") {
    if (this.#isTerraceAccessVoid(blockU, blockY, blockV)) {
      return;
    }
    const { blockX, blockZ } = this.#localToBlock(blockU, blockV);
    if (
      blockX < 0 ||
      blockX >= this.#layout.widthBlocks ||
      blockZ < 0 ||
      blockZ >= this.#layout.depthBlocks
    ) {
      return;
    }
    const key = `${blockU},${blockY},${blockV}`;
    if (this.#occupied.has(key)) {
      return;
    }
    this.#occupied.add(key);
    const position = this.#localToWorld(blockU, blockV);
    this.geometry.collision.cameraBlocks.push({
      x: position.x,
      y: this.#layout.baseY + (blockY + 0.5) * CASTLE_BLOCK_SIZE,
      z: position.z,
      halfX: CASTLE_BLOCK_SIZE / 2,
      halfY: CASTLE_BLOCK_SIZE / 2,
      halfZ: CASTLE_BLOCK_SIZE / 2,
    });
    if (blockY === 0) {
      const collisionKey = `${blockX},${blockZ}`;
      if (!this.#groundCollisionKeys.has(collisionKey)) {
        this.#groundCollisionKeys.add(collisionKey);
        this.geometry.collision.groundColumns.push(position);
      }
    }
    this.addLocalBox(blockU, blockY, blockV, 1, 1, 1, role);
  }

  addLocalBox(
    blockU,
    blockY,
    blockV,
    scaleU,
    scaleY,
    scaleV,
    role = "stone",
  ) {
    const position = this.#localToWorld(blockU, blockV);
    const rotated = ["NORTH", "SOUTH"].includes(this.#layout.primarySide);
    this.geometry.boxes.push({
      material: this.#materialFor(
        Math.round(blockU),
        Math.round(blockY),
        Math.round(blockV),
        role,
      ),
      x: position.x,
      y: this.#layout.baseY + (blockY + 0.5) * CASTLE_BLOCK_SIZE,
      z: position.z,
      yaw: 0,
      sx: (rotated ? scaleV : scaleU) * CASTLE_BLOCK_SIZE,
      sy: scaleY * CASTLE_BLOCK_SIZE,
      sz: (rotated ? scaleU : scaleV) * CASTLE_BLOCK_SIZE,
    });
  }

  addFlame(blockU, blockY, blockV, scale = 1) {
    const position = this.#localToWorld(blockU, blockV);
    this.geometry.decorations.flames.push({
      x: position.x,
      y: this.#layout.baseY + blockY * CASTLE_BLOCK_SIZE,
      z: position.z,
      scale: scale * CASTLE_BLOCK_SIZE,
    });
  }

  addBanner(
    blockU,
    blockY,
    blockV,
    widthBlocks,
    heightBlocks,
    boundary = CASTLE_BOUNDARY.FRONT,
  ) {
    const position = this.#localToWorld(blockU, blockV);
    const normal = this.#boundaryNormal(boundary);
    this.geometry.decorations.banners.push({
      x: position.x,
      y:
        this.#layout.baseY +
        (blockY + 0.5 + heightBlocks / 2) * CASTLE_BLOCK_SIZE,
      z: position.z,
      yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
      width: widthBlocks * CASTLE_BLOCK_SIZE,
      height: heightBlocks * CASTLE_BLOCK_SIZE,
    });
  }

  addFlag(
    blockU,
    blockY,
    blockV,
    boundary = CASTLE_BOUNDARY.FRONT,
    roofCollider = null,
  ) {
    const position = this.#localToWorld(blockU, blockV);
    const normal = this.#boundaryNormal(boundary);
    this.geometry.decorations.flags.push({
      x: position.x,
      y: this.#layout.baseY + blockY * CASTLE_BLOCK_SIZE,
      z: position.z,
      yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
      width: 5 * CASTLE_BLOCK_SIZE,
      height: 2.5 * CASTLE_BLOCK_SIZE,
      poleHeight: 5 * CASTLE_BLOCK_SIZE,
      roofCollider,
    });
  }

  addRoof(
    blockU,
    blockY,
    blockV,
    widthBlocks,
    depthBlocks,
    heightBlocks,
    boundary = CASTLE_BOUNDARY.FRONT,
  ) {
    const position = this.#localToWorld(blockU, blockV);
    const normal = this.#boundaryNormal(boundary);
    this.geometry.decorations.roofs.push({
      x: position.x,
      y: this.#layout.baseY + blockY * CASTLE_BLOCK_SIZE,
      z: position.z,
      yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
      width: widthBlocks * CASTLE_BLOCK_SIZE,
      depth: depthBlocks * CASTLE_BLOCK_SIZE,
      height: heightBlocks * CASTLE_BLOCK_SIZE,
    });
  }

  addRoofFireTurret(centerU, centerV, baseBlockY) {
    const turretU = Math.round(centerU);
    const turretV = Math.round(centerV);
    const turretHeight = 3;
    for (
      let blockY = baseBlockY;
      blockY < baseBlockY + turretHeight;
      blockY += 1
    ) {
      for (let offsetU = -1; offsetU <= 1; offsetU += 1) {
        for (let offsetV = -1; offsetV <= 1; offsetV += 1) {
          const topCourse = blockY === baseBlockY + turretHeight - 1;
          const edge = Math.abs(offsetU) === 1 || Math.abs(offsetV) === 1;
          this.addBlock(
            turretU + offsetU,
            blockY,
            turretV + offsetV,
            topCourse && edge ? "trim" : "stone",
          );
        }
      }
    }
    for (const [offsetU, offsetV] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [0, 0],
    ]) {
      this.addBlock(
        turretU + offsetU,
        baseBlockY + turretHeight,
        turretV + offsetV,
        "trim",
      );
    }
    return {
      blockU: turretU,
      blockV: turretV,
      flameBlockY: baseBlockY + turretHeight + 1,
    };
  }

  #isTerraceAccessVoid(blockU, blockY, blockV) {
    const opening = this.#layout.openings.find(
      (candidate) => candidate.boundary === CASTLE_BOUNDARY.FRONT,
    );
    if (!opening) {
      return false;
    }
    const wallHeight = this.#layout.style.wallHeightBlocks;
    const gatehouseDepth = Math.min(
      this.#layout.style.towerSpanBlocks,
      this.#layout.castleDepth,
    );
    const roofDoorWidth = 4;
    const roofDoorStart = Math.floor(
      (opening.start + opening.end - roofDoorWidth) / 2,
    );
    const roofDoorBase = wallHeight + 1;
    const doorway =
      blockV >= roofDoorStart &&
      blockV < roofDoorStart + roofDoorWidth &&
      blockU >= 1 &&
      blockU < gatehouseDepth &&
      blockY >= roofDoorBase &&
      blockY < roofDoorBase + 5;
    const stairheadSideWall =
      blockU === gatehouseDepth - 1 &&
      (blockV === roofDoorStart - 1 ||
        blockV === roofDoorStart + roofDoorWidth) &&
      blockY >= roofDoorBase &&
      blockY < roofDoorBase + 6;
    const lintel =
      blockU >= gatehouseDepth - 2 &&
      blockU < gatehouseDepth &&
      blockV >= roofDoorStart - 1 &&
      blockV <= roofDoorStart + roofDoorWidth &&
      blockY === roofDoorBase + 5;
    return (
      doorway ||
      stairheadSideWall ||
      lintel ||
      isCastleUpperFloorRoomVoid({
        blockU,
        blockY,
        blockV,
        opening,
        gatehouseDepth,
        wallHeight,
      })
    );
  }

  #materialFor(blockU, blockY, blockV, role) {
    const roleMaterials = {
      accent: "castleAccent",
      door: "castleDoor",
      doorLight: "castleDoorLight",
      iron: "castleIron",
      trim: "castleStoneLight",
      arch: "castleArchStone",
    };
    if (roleMaterials[role]) {
      return roleMaterials[role];
    }
    const hash =
      Math.imul(blockU + 11, 73856093) ^
      Math.imul(blockY + 17, 19349663) ^
      Math.imul(blockV + 23, 83492791);
    return [
      "castleStoneDark",
      "castleStoneMid",
      "castleStoneMid",
      "castleStoneMid",
      "castleStoneMid",
      "castleStoneMid",
      "castleStoneMid",
      "castleStoneDark",
    ][(hash >>> 0) % 8];
  }

  #localToBlock(blockU, blockV) {
    let blockX = blockU;
    let blockZ = blockV;
    if (this.#layout.primarySide === "EAST") {
      blockX = this.#layout.widthBlocks - 1 - blockU;
    } else if (this.#layout.primarySide === "NORTH") {
      blockX = blockV;
      blockZ = blockU;
    } else if (this.#layout.primarySide === "SOUTH") {
      blockX = blockV;
      blockZ = this.#layout.depthBlocks - 1 - blockU;
    }
    return { blockX, blockZ };
  }

  #localToWorld(blockU, blockV) {
    const { blockX, blockZ } = this.#localToBlock(blockU, blockV);
    return {
      x: this.#layout.worldLeft + (blockX + 0.5) * CASTLE_BLOCK_SIZE,
      z: this.#layout.worldTop + (blockZ + 0.5) * CASTLE_BLOCK_SIZE,
    };
  }

  #boundaryNormal(boundary) {
    const normals = {
      WEST: {
        [CASTLE_BOUNDARY.FRONT]: { x: -1, z: 0 },
        [CASTLE_BOUNDARY.BACK]: { x: 1, z: 0 },
        [CASTLE_BOUNDARY.LEFT]: { x: 0, z: -1 },
        [CASTLE_BOUNDARY.RIGHT]: { x: 0, z: 1 },
      },
      EAST: {
        [CASTLE_BOUNDARY.FRONT]: { x: 1, z: 0 },
        [CASTLE_BOUNDARY.BACK]: { x: -1, z: 0 },
        [CASTLE_BOUNDARY.LEFT]: { x: 0, z: -1 },
        [CASTLE_BOUNDARY.RIGHT]: { x: 0, z: 1 },
      },
      NORTH: {
        [CASTLE_BOUNDARY.FRONT]: { x: 0, z: -1 },
        [CASTLE_BOUNDARY.BACK]: { x: 0, z: 1 },
        [CASTLE_BOUNDARY.LEFT]: { x: -1, z: 0 },
        [CASTLE_BOUNDARY.RIGHT]: { x: 1, z: 0 },
      },
      SOUTH: {
        [CASTLE_BOUNDARY.FRONT]: { x: 0, z: 1 },
        [CASTLE_BOUNDARY.BACK]: { x: 0, z: -1 },
        [CASTLE_BOUNDARY.LEFT]: { x: -1, z: 0 },
        [CASTLE_BOUNDARY.RIGHT]: { x: 1, z: 0 },
      },
    };
    return normals[this.#layout.primarySide][boundary];
  }
}
