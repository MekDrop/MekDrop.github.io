import {
  CastleBuildPlanGatehouseCountMismatchError,
  CastleBuildPlanInteriorDepthInvalidError,
  CastleBuildPlanStyleMissingError,
  CastleBuildPlanWallMissingError,
} from "../../../errors/castle/index.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class ValidationStage extends AbstractCastleGenerationStage {
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    if (!context.layout.style) {
      throw new CastleBuildPlanStyleMissingError();
    }
    if (!context.structure.wall) {
      throw new CastleBuildPlanWallMissingError();
    }
    if (
      context.structure.gatehouses.length !== context.layout.openings.length
    ) {
      throw new CastleBuildPlanGatehouseCountMismatchError();
    }
    if (
      !Number.isFinite(context.metadata.runtime.interiorDepth) ||
      context.metadata.runtime.interiorDepth < 0
    ) {
      throw new CastleBuildPlanInteriorDepthInvalidError();
    }
  }
}
