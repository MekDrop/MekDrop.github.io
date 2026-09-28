/**
 * Mutable state owned by one map-generation run.
 *
 * Artifacts are grouped by concern so stage boundaries remain explicit:
 * input is immutable normalized input, world contains terrain grids, routing
 * contains path graph data, features contains placed content, and output
 * contains finalized consumer-facing data.
 */
export class GenerationContext {
  /**
   *
   * @param {{mapName?: string, numPaths?: number, numRivers?: number, overpass?: boolean, signal?: AbortSignal}} options
   * @param {{now: () => number, yieldToMainThread: () => Promise<void>, yieldIfNeeded: (state: {lastYield: number}) => Promise<void>, throwIfAborted?: () => void}} scheduler
   */
  constructor(options, scheduler) {
    /**
     *
     * @type {Readonly<{mapName?: string, numPaths?: number, numRivers?: number, overpass?: boolean, signal?: AbortSignal}>}
     */
    this.input = Object.freeze({ ...options });
    /**
     *
     * @type {{now: () => number, yieldToMainThread: () => Promise<void>, yieldIfNeeded: (state: {lastYield: number}) => Promise<void>, throwIfAborted?: () => void}}
     */
    this.scheduler = scheduler;
    /**
     *
     * @type {{lastYield: number}}
     */
    this.yieldState = { lastYield: scheduler.now() };
    /**
     *
     * @type {import("src/game/GameContracts.js").MapGenerationWorld}
     */
    this.world = {};
    /**
     *
     * @type {import("src/game/GameContracts.js").MapGenerationRouting}
     */
    this.routing = {};
    /**
     *
     * @type {import("src/game/GameContracts.js").MapGenerationFeatures}
     */
    this.features = {};
    /**
     *
     * @type {import("src/game/GameContracts.js").MapGenerationOutput}
     */
    this.output = {};
  }
}
