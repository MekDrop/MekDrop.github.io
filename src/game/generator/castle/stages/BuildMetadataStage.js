import { CASTLE_BOUNDARY } from "../../../enum/CastleBoundary.js";
import {
  CASTLE_BLOCK_SIZE,
  CASTLE_WALL_THICKNESS_BLOCKS,
} from "../CastleGenerationConfig.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class BuildMetadataStage extends AbstractCastleGenerationStage {
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    const { castleDepth, facadeSpan, openings, primarySide, baseY } =
      context.layout;
    const { towerSpan, wallHeight } = context.structure.wall;
    const audienceOpening = openings.find(
      (opening) => opening.boundary === CASTLE_BOUNDARY.FRONT,
    );
    const interiorDepth =
      (castleDepth - CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    let interiorWidth = 0;
    let terrace = null;
    if (audienceOpening) {
      const openingCenter =
        ((audienceOpening.start + audienceOpening.end) / 2) * CASTLE_BLOCK_SIZE;
      const interiorStart = CASTLE_WALL_THICKNESS_BLOCKS * CASTLE_BLOCK_SIZE;
      const interiorEnd =
        (facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
      interiorWidth =
        Math.min(openingCenter - interiorStart, interiorEnd - openingCenter) * 2;
      const gatehouseDepth = Math.min(towerSpan, castleDepth);
      const doorStart = Math.floor(
        (audienceOpening.start + audienceOpening.end - 4) / 2,
      );
      const localPosition = this.#localToWorld(
        context.layout,
        gatehouseDepth - 0.68,
        doorStart + 1.5,
      );
      terrace = {
        ...localPosition,
        y: baseY + (wallHeight + 1) * CASTLE_BLOCK_SIZE,
        yaw: { WEST: 90, EAST: -90, NORTH: 0, SOUTH: 180 }[primarySide],
        depth: (castleDepth - gatehouseDepth - 1) * CASTLE_BLOCK_SIZE,
        width: interiorWidth,
      };
    }
    context.metadata.runtime = {
      interiorDepth,
      interiorWidth,
      audienceOpening: audienceOpening ? { ...audienceOpening } : null,
      terrace,
    };
    context.metadata.collision = {
      blockSize: CASTLE_BLOCK_SIZE,
      groundCourse: 0,
      cameraBlockHalfExtents: {
        x: CASTLE_BLOCK_SIZE / 2,
        y: CASTLE_BLOCK_SIZE / 2,
        z: CASTLE_BLOCK_SIZE / 2,
      },
      groundColumns: context.geometry.collision.groundColumns.map((column) => ({
        ...column,
      })),
      cameraBlocks: context.geometry.collision.cameraBlocks.map((block) => ({
        ...block,
      })),
    };
  }

  #localToWorld(layout, blockU, blockV) {
    let blockX = blockU;
    let blockZ = blockV;
    if (layout.primarySide === "EAST") {
      blockX = layout.widthBlocks - 1 - blockU;
    } else if (layout.primarySide === "NORTH") {
      blockX = blockV;
      blockZ = blockU;
    } else if (layout.primarySide === "SOUTH") {
      blockX = blockV;
      blockZ = layout.depthBlocks - 1 - blockU;
    }
    return {
      x: layout.worldLeft + (blockX + 0.5) * CASTLE_BLOCK_SIZE,
      z: layout.worldTop + (blockZ + 0.5) * CASTLE_BLOCK_SIZE,
    };
  }
}
