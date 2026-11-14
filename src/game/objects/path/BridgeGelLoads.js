import { BridgeGelReaction } from "./BridgeGelReaction.js";

/**
 * @typedef {object} BridgeGelWalker
 * @property {import("../ObjectTypes.js").Point3} position
 * @property {boolean} grounded
 * @property {boolean} [alive]
 * @property {boolean} [airborne]
 * @property {import("playcanvas").Entity|null} [carrier]
 */

/**
 * Collects supported walkers through the registry's cached capability index.
 * Each identity owns one footfall history even if registered in multiple roles.
 */
export class BridgeGelLoads {
  /**
   * @type {Map<BridgeGelWalker, BridgeGelReaction>}
   */
  #reactions = new Map();

  /**
   * @param {number} deltaTime
   * @param {import("../../rendering/scene/SceneObjectRegistry.js").SceneObjectRegistry|undefined} registry
   * @param {Parameters<BridgeGelReaction["update"]>[2]} bridge
   * @returns {Map<number, import("./BridgeGelReaction.js").BridgeGelLoad>}
   */
  update(deltaTime, registry, bridge) {
    const walkers = new Set(registry?.getMatching?.(BridgeGelLoads.#isWalker) ?? []);
    const hero = registry?.getOne?.("hero");
    if (hero) {
      walkers.add(hero);
    }
    for (const walker of walkers) {
      if (!this.#reactions.has(walker)) {
        this.#reactions.set(walker, new BridgeGelReaction());
      }
    }
    const loads = new Map();
    for (const [walker, reaction] of this.#reactions) {
      const supported = walkers.has(walker) && walker.alive !== false && !walker.airborne && !walker.carrier;
      const actorLoads = reaction.update(deltaTime, supported ? walker : null, bridge);
      for (const [station, load] of actorLoads) {
        const total = loads.get(station);
        if (total) {
          const weight = total.compression + load.compression;
          if (weight > 0) {
            total.along = (total.along * total.compression + load.along * load.compression) / weight;
            total.across = (total.across * total.compression + load.across * load.compression) / weight;
          }
          total.compression = Math.min(1, weight);
          total.bounce = Math.max(-1, Math.min(1, total.bounce + load.bounce));
        } else {
          loads.set(station, { ...load });
        }
      }
      if (!walkers.has(walker) && actorLoads.size === 0) {
        this.#reactions.delete(walker);
      }
    }

    return loads;
  }

  /**
   * @param {import("../../GameContracts.js").GameObjectContract} object
   * @returns {boolean}
   */
  static #isWalker(object) {
    return typeof object.grounded === "boolean" && Boolean(object.position);
  }
}
