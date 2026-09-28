import { MapGenerationStageRunNotImplementedError } from "../../errors/map/index.js";

/**
 * @abstract
 * Defines one isolated step in a map-generation run.
 */
export class AbstractMapGenerationStage {
  /**
   * @abstract
   * Reads and writes the documented artifacts on the generation context.
   * @param {import("./GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    void context;
    throw new MapGenerationStageRunNotImplementedError(this.constructor.name);
  }
}
