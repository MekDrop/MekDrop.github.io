import { ObjectDataCache } from "../../../cache/ObjectDataCache.js";
import modelUrl from "../../../models/castle/residential/terrace-planter.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";

/**
 * Boxwood in a stone planter, placed through the room's map objects.
 */
export class Planter extends AbstractCastleProp {

  /**
   * Vary foliage placement while preserving authored block shapes and colors.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const nodes = Array.from({ length: 5 }, /**
     *
     * @param {undefined} _
     * @param {number} index
     */
      (_, index) => model.findByName(index === 0 ? "Boxwood foliage" :
        `Boxwood foliage.${String(index).padStart(3, "0")}`));
    const positions = nodes.map(/**
     *
     * @param {import("playcanvas").Entity|null} node
     */
      (node) => {
        const p = node?.getLocalPosition();

        return p ? [p.x, p.y, p.z] : null;
      });
    const seed = `${this.definition.id}:boxwood`;
    const layout = ObjectDataCache.resolve("planters", {
      seed,
      positions,
    }, () => {
      const random = new GenerationRandom(seed);
      const angle = random.rng(0, 3) * Math.PI / 2;
      const mirror = random.rng(0, 1) ? 1 : -1;

      return positions.map(/**
       *
       * @param {number[]|null} position
       * @param {number} index
       */
        (position, index) => {
        // Keep RNG consumption and sub-grid offsets identical to generation.
          const offsetX = random.rng(-4, 4) / 100 + index * 0.001;
          const offsetZ = random.rng(-4, 4) / 100 + index * 0.001;
          if (!position) {
            return null;
          }
          return [
            position[0] * mirror * Math.cos(angle) - position[2] * Math.sin(angle) + offsetX,
            position[1],
            position[0] * mirror * Math.sin(angle) + position[2] * Math.cos(angle) + offsetZ,
          ];
        });
    });
    for (const [index, position] of layout.entries()) {
      if (position) {
        nodes[index].setLocalPosition(...position);
      }
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
