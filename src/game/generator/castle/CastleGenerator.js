import { CastleGenerationContext } from "./CastleGenerationContext.js";
import { CastleGenerationScheduler } from "./CastleGenerationScheduler.js";
import { createCastleGenerationPipeline } from "./createCastleGenerationPipeline.js";
import { BuildMetadataStage } from "./stages/BuildMetadataStage.js";
import { FinalizationStage } from "./stages/FinalizationStage.js";
import { GatehouseStage } from "./stages/GatehouseStage.js";
import { LayoutStyleStage } from "./stages/LayoutStyleStage.js";
import { TowerStage } from "./stages/TowerStage.js";
import { ValidationStage } from "./stages/ValidationStage.js";
import { WallStage } from "./stages/WallStage.js";

export class CastleGenerator {
  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string, seed?: string|number, scheduler?: CastleGenerationScheduler, signal?: AbortSignal}} options
   */
  static generate(options = {}) {
    const generate = createCastleGenerationPipeline({
      /**
       *
       * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string, seed?: string|number, scheduler?: CastleGenerationScheduler, signal?: AbortSignal}} pipelineOptions
       */
      createContext: (pipelineOptions) => {
        const scheduler =
          pipelineOptions.scheduler ??
          new CastleGenerationScheduler({ signal: pipelineOptions.signal });
        return new CastleGenerationContext(pipelineOptions, scheduler);
      },
      createStages: () => [
        new LayoutStyleStage(),
        new WallStage(),
        new TowerStage(),
        new GatehouseStage(),
        new BuildMetadataStage(),
        new ValidationStage(),
        new FinalizationStage(),
      ],
    });
    return generate(options);
  }
}
