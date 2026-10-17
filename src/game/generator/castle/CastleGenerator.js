import { CastleAuthoredBuildPlan } from "./CastleAuthoredBuildPlan.js";

/**
 * Seed-driven entry point for authored castle construction.
 */
export class CastleGenerator {
  /**
   * @param {{position:import("../../GameContracts.js").GridPoint,doors:import("../../GameContracts.js").CastleOpening[],basePlanId?:string,seed?:string|number,scheduler?:import("./CastleGenerationScheduler.js").CastleGenerationScheduler,signal?:AbortSignal}} options
   * @returns {Promise<import("../../GameContracts.js").CastleBuildPlan>}
   */
  static generate(options = {}) {
    return CastleAuthoredBuildPlan.generate({
      basePlanId: options.basePlanId,
      position: options.position,
      doors: options.doors,
      seed: options.seed,
      scheduler: options.scheduler,
      signal: options.signal,
      requestedStyle: options.requestedStyle,
    });
  }
}
