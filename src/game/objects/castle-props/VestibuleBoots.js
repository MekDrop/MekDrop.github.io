import modelUrl from "../../models/castle/props/vestibule-boots.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

/**
 * A pair of muddy boots grounded beside resting furniture.
 */
export class VestibuleBoots extends AbstractCastleProp {
  /**
   * Keep each pair's placement and leather finish stable across reloads.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const random = new GenerationRandom(`${this.definition.id}:boots`);
    const position = model.getLocalPosition().clone();
    position.x += random.rng(-10, 10) / 100;
    position.z += random.rng(-1, 1) / 100;
    model.setLocalPosition(position);
    model.setLocalEulerAngles(0, random.rng(-5, 5), 0);
    const scale = model.getLocalScale().clone();
    const size = random.rng(90, 100) / 100;
    model.setLocalScale(scale.x * size, scale.y * size, scale.z * size);
    const colors = [[0.95, 0.78, 0.56], [0.42, 0.43, 0.46],
      [0.66, 0.38, 0.26], [0.52, 0.59, 0.43]];
    const color = random.randomItem(colors);
    const leadingSide = random.rng(0, 1) ? 1 : -1;
    const stagger = random.rng(3, 5) / 100;
    for (const [index, name] of ["Boot Left", "Boot Right"].entries()) {
      const boot = model.findByName(name);
      if (!boot) { continue; }
      const bootPosition = boot.getLocalPosition().clone();
      bootPosition.z += (index ? -1 : 1) * leadingSide * stagger;
      boot.setLocalPosition(bootPosition);
      boot.setLocalEulerAngles(0, random.rng(-7, 7), 0);
    }
    if (collision) { return; }
    for (const render of model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        const material = this.cloneMaterial(mesh.material);
        material.diffuse.set(...color);
        material.update();
        mesh.material = material;
      }
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
