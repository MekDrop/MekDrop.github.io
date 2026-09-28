export class MapGenerationPipeline {
  /**
   *
   * @type {import("./AbstractMapGenerationStage.js").AbstractMapGenerationStage[]}
   */
  #stages;

  /**
   *
   * @param {import("./AbstractMapGenerationStage.js").AbstractMapGenerationStage[]} stages
   */
  constructor(stages) {
    /**
     *
     * @type {import("./AbstractMapGenerationStage.js").AbstractMapGenerationStage[]}
     */
    this.#stages = stages;
  }

  /**
   *
   * @param {GenerationContext} context
   */
  async run(context) {
    await context.scheduler.yieldToMainThread();
    for (const stage of this.#stages) {
      await stage.run(context);
      await context.scheduler.yieldIfNeeded(context.yieldState);
    }
    await context.scheduler.yieldToMainThread();
    return context.output.mapData;
  }
}
