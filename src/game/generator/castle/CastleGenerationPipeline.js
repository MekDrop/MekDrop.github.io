export class CastleGenerationPipeline {
  #stages;

  constructor(stages) {
    this.#stages = stages;
  }

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
