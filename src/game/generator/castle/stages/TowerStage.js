import {
  CASTLE_TOWER_HEIGHT_BLOCKS,
  CASTLE_TOWER_SPAN_BLOCKS,
} from "../CastleGenerationConfig.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class TowerStage extends AbstractCastleGenerationStage {
  /**
   *
   * @param {CastleGenerationContext} context
   */
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    const { style, castleDepth, facadeSpan } = context.layout;
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const towerHeight = style.towerHeightBlocks ?? CASTLE_TOWER_HEIGHT_BLOCKS;
    const placements = {
      FRONT_LEFT: { u: 0, v: 0, front: true },
      FRONT_RIGHT: { u: 0, v: facadeSpan - towerSpan, front: true },
      BACK_LEFT: { u: castleDepth - towerSpan, v: 0, front: false },
      BACK_RIGHT: {
        u: castleDepth - towerSpan,
        v: facadeSpan - towerSpan,
        front: false,
      },
    };
    if (context.layout.roomPlan?.version === 2) {
      const plan = context.layout.roomPlan;
      const opening = context.layout.openings.find(/**
       *
       * @param {{boundary:string}} entry
       */
      (entry) => entry.boundary === "FRONT");
      const middle = (opening.start + opening.end - 1) / 2;
      const sign = ["WEST", "SOUTH"].includes(context.layout.primarySide) ? -1 : 1;
      context.structure.towers = plan.placedRooms.filter(/**
       *
       * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
       */
      (room) => room.id.startsWith("tower")).map(/**
       *
       * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
       */
      (room) => ({
        u: Math.round((room.minZ - 0.125) * 4),
        v: Math.round(middle + sign * (sign > 0 ? room.minX - 0.125 : room.maxX + 0.125) * 4),
        span: Math.round((room.maxX - room.minX + 0.25) * 4),
        depth: Math.round((room.maxZ - room.minZ + 0.25) * 4),
        baseBlockY: 0, shellHeight: Math.round(plan.rise * 4) + 9,
        roomId: room.id, front: room.minZ < castleDepth / 8, height: Math.max(towerHeight, Math.round(plan.rise * 4) + 13),
      }));
    } else {
    context.structure.towers = (style.towerPlacements ?? [])
      .map(/**
       *
       * @param {{position: pc.Vec3, rotation?: pc.Quat}} placement
       */
      (placement) => placements[placement])
      .filter(Boolean)
      .map(/**
       *
       * @param {{entity: pc.Entity, position?: pc.Vec3}} tower
       */
      (tower) => ({
        ...tower,
        span: towerSpan,
        height: towerHeight,
      }));
    }
    await context.planning.geometryPlanner.buildTowers(
      context,
      context.planning.writer,
    );
  }
}
