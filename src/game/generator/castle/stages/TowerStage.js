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
    await context.planning.geometryPlanner.buildTowers(
      context,
      context.planning.writer,
    );
  }
}
