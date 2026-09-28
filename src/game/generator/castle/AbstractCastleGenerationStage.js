import { CastleGenerationStageRunNotImplementedError } from "../../errors/castle/index.js";

/**
 * @abstract
 * Defines one isolated step in a castle-generation run.
 */
export class AbstractCastleGenerationStage {
  /**
   * @abstract
   * Reads and writes the documented artifacts on the generation context.
   * @param {import("./CastleGenerationContext.js").CastleGenerationContext} context
   */
  async run(context) {
    void context;
    throw new CastleGenerationStageRunNotImplementedError(
      this.constructor.name,
    );
  }
}
