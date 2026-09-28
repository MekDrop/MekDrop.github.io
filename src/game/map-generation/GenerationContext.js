/**
 * Mutable state owned by one map-generation run.
 *
 * Artifacts are grouped by concern so stage boundaries remain explicit:
 * input is immutable normalized input, world contains terrain grids, routing
 * contains path graph data, features contains placed content, and output
 * contains finalized consumer-facing data.
 */
export class GenerationContext {
  constructor(options, scheduler) {
    this.input = Object.freeze({ ...options });
    this.scheduler = scheduler;
    this.yieldState = { lastYield: scheduler.now() };
    this.world = {};
    this.routing = {};
    this.features = {};
    this.output = {};
  }
}
