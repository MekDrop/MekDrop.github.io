export class MapGenerationPipeline {
  #stages;

  constructor(stages) {
    this.#stages = stages;
  }

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
