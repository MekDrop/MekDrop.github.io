import { MapGenerationPipeline } from "./MapGenerationPipeline.js";

/**
 *
 * @param {{createContext: (options: {mapName?: string, numPaths?: number, numRivers?: number, signal?: AbortSignal}) => import("./GenerationContext.js").GenerationContext, createStages: () => import("./AbstractMapGenerationStage.js").AbstractMapGenerationStage[]}} options
 * @param {(options: {mapName?: string, numPaths?: number, numRivers?: number, signal?: AbortSignal}) => import("./GenerationContext.js").GenerationContext} options.createContext
 * @param {() => import("./AbstractMapGenerationStage.js").AbstractMapGenerationStage[]} options.createStages
 */
export function createMapGenerationPipeline({ createContext, createStages }) {
  /**
   *
   * @param {{mapName?: string, numPaths?: number, numRivers?: number, signal?: AbortSignal}} options
   */
  return async function generate(options) {
    const context = createContext(options);
    const pipeline = new MapGenerationPipeline(createStages());
    return pipeline.run(context);
  };
}
