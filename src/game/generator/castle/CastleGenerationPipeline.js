export class CastleGenerationPipeline {
  /**
   *
   * @type {import("./AbstractCastleGenerationStage.js").AbstractCastleGenerationStage[]}
   */
  #stages;

  /**
   *
   * @param {import("./AbstractCastleGenerationStage.js").AbstractCastleGenerationStage[]} stages
   */
  constructor(stages) {
    /**
     *
     * @type {import("./AbstractCastleGenerationStage.js").AbstractCastleGenerationStage[]}
     */
    this.#stages = stages;
  }

  /**
   *
   * @param {CastleGenerationContext} context
   */
  async run(context) {
    try {
      await context.scheduler.yieldToMainThread();
      for (const stage of this.#stages) {
        context.scheduler.throwIfAborted();
        await stage.run(context);
        await context.scheduler.yieldIfNeeded(context.yieldState);
      }
      await context.scheduler.yieldToMainThread();
      return context.output.buildPlan;
    } catch (error) {
      context.cleanup();
      throw error;
    }
  }
}
