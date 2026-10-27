import modelUrl from "../../../models/castle/props/vestibule-stick-stand.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";

/**
 * Walking sticks and a folded umbrella in an oak holder.
 */
export class VestibuleStickStand extends AbstractCastleProp {
  /**
   * @param {string|number} seed
   * @returns {{names:string[],rotation:number,color:number[]}}
   */
  static variation(seed) {
    const random = new GenerationRandom(`${seed}:umbrella-holder`);
    const contents = [["Tripo folded umbrella", "Tripo oak walking stick"],
      ["Tripo folded umbrella", "Tripo short walking stick"],
      ["Tripo folded umbrella", "Tripo oak walking stick", "Tripo short walking stick"],
      ["Tripo oak walking stick", "Tripo short walking stick"]];
    const colors = [[0.75, 0.86, 1], [1, 0.76, 0.64], [0.73, 0.91, 0.68], [0.91, 0.78, 1]];

    return {
      names: [...random.randomItem(contents)],
      rotation: random.rng(0, 3) * 90,
      color: [...random.randomItem(colors)],
    };
  }

  /**
   * Retain the common authored bottom pivot, so all shafts stay in the holder
   * and their original non-intersecting relationships rotate together.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const variation = VestibuleStickStand.variation(this.definition.seed ?? this.definition.id);
    for (const name of ["Tripo folded umbrella", "Tripo oak walking stick", "Tripo short walking stick"]) {
      const node = model.findByName(name);
      if (!node) {
        continue;
      }
      if (!variation.names.includes(name)) {
        node.destroy();
        continue;
      }
      node.setLocalEulerAngles(0, variation.rotation, 0);
      if (collision || name !== "Tripo folded umbrella") {
        continue;
      }
      for (const render of node.findComponents("render")) {
        for (const mesh of render.meshInstances) {
          const material = this.cloneMaterial(mesh.material);
          material.diffuse.set(...variation.color);
          material.diffuseTint = true;
          material.update();
          mesh.material = material;
        }
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
