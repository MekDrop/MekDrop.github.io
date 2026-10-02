import { CASTLE_BOUNDARY } from "../../../enum/CastleBoundary.js";
import {
  CASTLE_GATE_CROWN_HEIGHT_BLOCKS,
  CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
  CASTLE_GATE_PYLON_SPAN_BLOCKS,
  CASTLE_TOWER_HEIGHT_BLOCKS,
  CASTLE_TOWER_SPAN_BLOCKS,
  CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS,
  CASTLE_WALL_HEIGHT_BLOCKS,
} from "../CastleGenerationConfig.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class GatehouseStage extends AbstractCastleGenerationStage {
  /**
   *
   * @param {CastleGenerationContext} context
   */
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    const { style, castleDepth, facadeSpan, openings } = context.layout;
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const towerHeight = style.towerHeightBlocks ?? CASTLE_TOWER_HEIGHT_BLOCKS;
    context.structure.gatehouses = openings.map(/**
     *
     * @param {import("src/game/GameContracts.js").CastleOpening} opening
     */
    (opening) => {
      const primary = opening.boundary === CASTLE_BOUNDARY.FRONT;
      const gatehouseDepth = primary && context.layout.roomPlan
        ? context.layout.roomPlan.gatehouseDepth / 0.25
        : Math.min(towerSpan, castleDepth);
      const gatehouseHeight = towerHeight;
      const roofDoorWidth = 4;
      const roofDoorStart = Math.floor(
        (opening.start + opening.end - roofDoorWidth) / 2,
      );
      const wallHeight = style.wallHeightBlocks ?? CASTLE_WALL_HEIGHT_BLOCKS;
      return {
        opening: { ...opening },
        primary,
        pylonSpan: CASTLE_GATE_PYLON_SPAN_BLOCKS,
        gatehouseDepth,
        gatehouseHeight,
        gateFaceDepth: Math.min(1, gatehouseDepth - 1),
        roofDoorWidth,
        roofDoorHeight: CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS,
        roofDoorStart,
        roofDoorBase: wallHeight + 1,
        crownShoulder: primary ? style.gateShoulderSpanBlocks ?? 3 : null,
        crownHeight: primary
          ? Math.max(
              gatehouseHeight + 2,
              style.gateCrownHeightBlocks ?? CASTLE_GATE_CROWN_HEIGHT_BLOCKS,
            )
          : null,
        crownBase: CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4,
        horizontalLimit: [
          CASTLE_BOUNDARY.FRONT,
          CASTLE_BOUNDARY.BACK,
        ].includes(opening.boundary)
          ? facadeSpan
          : castleDepth,
      };
    });
    await context.planning.geometryPlanner.buildGatehouses(
      context,
      context.planning.writer,
    );
  }
}
