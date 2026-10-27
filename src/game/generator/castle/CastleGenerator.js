import { ObjectDataCache } from "../../cache/ObjectDataCache.js";
import { CastleGenerationScheduler } from "./CastleGenerationScheduler.js";
import { CastleAuthoredBuildPlan } from "./CastleAuthoredBuildPlan.js";
import { CastleTerraceAppearance } from "./CastleTerraceAppearance.js";

/**
 * Seed-driven entry point for authored castle construction.
 */
export class CastleGenerator {
  /**
   * @type {boolean}
   */
  static cacheEnabled = true;

  /**
   * @param {{position:import("../../GameContracts.js").GridPoint,doors:import("../../GameContracts.js").CastleOpening[],basePlanId?:string,seed?:string|number,scheduler?:import("./CastleGenerationScheduler.js").CastleGenerationScheduler,signal?:AbortSignal,requestedStyle?:string}} options
   * @returns {Promise<import("../../GameContracts.js").CastleBuildPlan>}
   */
  static async generate(options = {}) {
    const scheduler = options.scheduler ?? new CastleGenerationScheduler({ signal: options.signal });
    scheduler.throwIfAborted();
    const input = {
      basePlanId: options.basePlanId,
      position: options.position,
      doors: options.doors,
      seed: options.seed,
      requestedStyle: options.requestedStyle,
    };
    const generate = async () => {
      const plan = await CastleAuthoredBuildPlan.generate({
        ...input,
        scheduler,
      });
      // Runtime scheduling and cancellation handles are not plan data.
      delete plan.input.scheduler;
      delete plan.input.signal;

      return CastleTerraceAppearance.apply(plan);
    };
    const plan = this.cacheEnabled
      ? await ObjectDataCache.resolveAsync("castle-plans", {
        ...input,
        atticAccessVersion: 4,
        furnishingVersion: 3,
      }, generate)
      : await generate();
    scheduler.throwIfAborted();

    return plan;
  }
}
