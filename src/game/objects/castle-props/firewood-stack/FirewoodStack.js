import { PropAssemblyCache } from "../../../cache/PropAssemblyCache.js";
import { arePositiveFiniteNumbers } from "../../../helpers/types.js";
import modelUrl from "../../../models/castle/props/firewood-stack.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";

/**
 * Fills a bottom-centered local area with seeded, individually varied cut logs.
 * Width/depth/height are model-space metres, before the usual prop scale/stretch.
 */
export class FirewoodStack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }

  /**
   * Reuse the authored log meshes for both visible and collision assemblies.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width = 0.269, depth = 0.38, height = 0.2433, firewoodSeed } = this.definition;
    const originals = model.find(FirewoodStack.#findEntity);
    const templates = originals.map(FirewoodStack.#mapEntity);
    for (const original of originals) {
      original.destroy();
    }
    if (!templates.length || !arePositiveFiniteNumbers(width, depth, height)) {
      for (const template of templates) {
        template.destroy();
      }

      return;
    }
    PropAssemblyCache.populate("firewood-stacks", {
      width,
      depth,
      height,
      seed: String(firewoodSeed ?? this.definition.id),
      templates: templates.length,
    }, model, templates, /**
     *
     * @param {(index: number, entity: import("playcanvas").Entity) => void} add
     */
    (add) => {
      const random = new GenerationRandom(String(firewoodSeed ?? this.definition.id));
      // Narrowing courses nest each upper log between two logs below it.
      const diameter = 0.088633;
      const logHeight = 0.0872862;
      const courseRise = Math.sqrt(logHeight ** 2 - (diameter / 2) ** 2);
      const columns = Math.max(1, Math.floor((width + 1e-6) / diameter));
      const rows = Math.max(1, Math.ceil(depth / 0.38));
      const layers = Math.min(columns, Math.max(1, Math.ceil((height - logHeight) / courseRise) + 1));
      if (columns * rows * layers > 4096) {
        return;
      }
      const cellZ = depth / rows;
      const diameterScale = Math.min(1, width / (columns * diameter),
        height / (logHeight + (layers - 1) * courseRise));
      const pitch = diameter * diameterScale;
      for (let layer = 0; layer < layers; layer++) {
        const count = columns - layer;
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < count; column++) {
            const templateIndex = random.rng(0, templates.length - 1);
            const log = templates[templateIndex].clone();
            const length = Math.min(0.38, cellZ) * random.rng(88, 100) / 100;
            const axialOffset = (cellZ - length) * random.rng(-50, 50) / 100;
            log.name = `Firewood log ${layer}-${row}-${column}`;
            log.setLocalEulerAngles(90, 0, 0);
            // Authored length is on the mesh's local Y axis.
            log.setLocalScale(diameterScale, length / 0.38, diameterScale);
            log.setLocalPosition((column - (count - 1) / 2) * pitch,
              (layer * courseRise + 0.0422862) * diameterScale,
              -depth / 2 + (row + 0.5) * cellZ + axialOffset);
            add(templateIndex, log);
          }
        }
      }
    });
    for (const template of templates) {
      template.destroy();
    }
  }

  /**
   *
   * @param {import("playcanvas").Entity} entity
   */
  static #findEntity(entity) {
    return entity.name.startsWith("Cut firewood log ");
  }

  /**
   *
   * @param {import("playcanvas").Entity} entity
   */
  static #mapEntity(entity) {
    return entity.clone();
  }
}
