import { CastleGenerationPipeline } from "./CastleGenerationPipeline.js";

/**
 *
 * @param {{createContext: (options: {position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string, signal?: AbortSignal}) => import("./CastleGenerationContext.js").CastleGenerationContext, createStages: () => import("./AbstractCastleGenerationStage.js").AbstractCastleGenerationStage[]}} options
 * @param {(options: {position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string, signal?: AbortSignal}) => import("./CastleGenerationContext.js").CastleGenerationContext} options.createContext
 * @param {() => import("./AbstractCastleGenerationStage.js").AbstractCastleGenerationStage[]} options.createStages
 */
export function createCastleGenerationPipeline({ createContext, createStages }) {
  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string, signal?: AbortSignal}} options
   */
  return async function generate(options) {
    const context = createContext(options);
    const pipeline = new CastleGenerationPipeline(createStages());
    return pipeline.run(context);
  };
}
