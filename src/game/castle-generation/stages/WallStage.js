import { CASTLE_BOUNDARY } from "../../enum/CastleBoundary.js";
import {
  CASTLE_TOWER_SPAN_BLOCKS,
  CASTLE_WALL_HEIGHT_BLOCKS,
  CASTLE_WALL_THICKNESS_BLOCKS,
} from "../CastleGenerationConfig.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";
import { CastleBuildPlanWriter } from "../CastleBuildPlanWriter.js";
import { CastleGeometryPlanner } from "../CastleGeometryPlanner.js";

export class WallStage extends AbstractCastleGenerationStage {
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    const { style, castleDepth, facadeSpan, openings } = context.layout;
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const wallHeight = style.wallHeightBlocks ?? CASTLE_WALL_HEIGHT_BLOCKS;
    const battlementPeriod = style.battlementPeriod ?? 2;
    context.structure.wall = {
      castleDepth,
      facadeSpan,
      towerSpan,
      wallHeight,
      battlementPeriod,
      wallWings: [...style.wallWings],
    };

    const audienceOpening = openings.find(
      (opening) => opening.boundary === CASTLE_BOUNDARY.FRONT,
    );
    context.structure.audienceWing = audienceOpening
      ? {
          opening: { ...audienceOpening },
          roomStart: 0,
          roomEnd: facadeSpan,
          backWallStart: castleDepth - CASTLE_WALL_THICKNESS_BLOCKS,
        }
      : null;
    context.planning.writer = new CastleBuildPlanWriter(context);
    context.planning.geometryPlanner = new CastleGeometryPlanner();
    await context.planning.geometryPlanner.buildWalls(
      context,
      context.planning.writer,
    );
  }
}
