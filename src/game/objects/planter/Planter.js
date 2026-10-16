import modelUrl from "../../models/castle/residential/terrace-planter.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

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
    const random = new GenerationRandom(`${this.definition.id}:boxwood`);
    const angle = random.rng(0, 3) * Math.PI / 2;
    const mirror = random.rng(0, 1) ? 1 : -1;
    for (let index = 0; index < 5; index++) {
      const node = model.findByName(index === 0 ? "Boxwood foliage" :
        `Boxwood foliage.${String(index).padStart(3, "0")}`);
      // Authored faces and random offsets share a centimetre grid. Give each
      // block a distinct sub-grid offset so overlapping faces cannot coincide.
      const offsetX = random.rng(-4, 4) / 100 + index * 0.001;
      const offsetZ = random.rng(-4, 4) / 100 + index * 0.001;
      if (!node) { continue; }
      const position = node.getLocalPosition().clone();
      node.setLocalPosition(
        position.x * mirror * Math.cos(angle) - position.z * Math.sin(angle) + offsetX,
        position.y,
        position.x * mirror * Math.sin(angle) + position.z * Math.cos(angle) + offsetZ,
      );
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
