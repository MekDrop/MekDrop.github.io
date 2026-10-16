import modelUrl from "../../../models/castle/props/vestibule-cloak-rail.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";

/**
 * Tripo-authored peg rail and travelling cloaks.
 */
export class VestibuleCloakRail extends AbstractCastleProp {
  /**
   * Stable per-rail hook occupancy and fabric colors.
   * @param {string} seed
   * @returns {Array<{name:string,hookX:number,authoredX:number,color:number[]}>}
   */
  static variation(seed) {
    const random = new GenerationRandom(seed);
    // Enlarged garments need the outer hooks when both are occupied.
    const hooks = random.shuffle([-0.33, 0.33]);
    const cloaks = random.shuffle([{
      name: "Cloak A",
      authoredX: -0.11,
    }, {
      name: "Cloak B",
      authoredX: 0.11,
    }]);
    const colors = [[0.46, 0.57, 0.69], [0.69, 0.34, 0.27], [0.39, 0.51, 0.32],
      [0.70, 0.56, 0.32], [0.55, 0.39, 0.57], [0.42, 0.44, 0.47]];
    const firstColor = random.rng(0, colors.length - 1);
    const secondColor = (firstColor + random.rng(1, colors.length - 1)) % colors.length;

    return cloaks.slice(0, random.rng(1, 2)).map(/**
     * @param {{name:string,authoredX:number}} cloak
     * @param {number} index
     */ (cloak, index) => ({
        ...cloak,
        hookX: hooks[index],
        color: colors[index ? secondColor : firstColor],
      }));
  }

  /**
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const variation = VestibuleCloakRail.variation(this.definition.id);
    VestibuleCloakRail.#prepareCloak(this, model, variation, collision, "Cloak A");
    VestibuleCloakRail.#prepareCloak(this, model, variation, collision, "Cloak B");
  }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * @param {VestibuleCloakRail} rail
   * @param {import("playcanvas").Entity} model
   * @param {ReturnType<typeof VestibuleCloakRail.variation>} variation
   * @param {boolean} collision
   * @param {string} name
   */
  static #prepareCloak(rail, model, variation, collision, name) {
    const node = model.findByName(name);
    if (!node) { return; }
    const item = variation.find(/**
     * @param {{name:string}} cloak
     */ cloak => cloak.name === name);
    if (!item) { node.destroy();

      return; }
    const position = node.getLocalPosition().clone();
    position.x += item.hookX - item.authoredX;
    // Adult-sized garments: enlarge around the authored loop.
    const garmentScale = 1.75;
    const loopHeight = 0.78;
    const scale = node.getLocalScale().clone();
    position.y -= loopHeight * scale.y * (garmentScale - 1);
    // Seat the loop over the peg's upper/front edge rather than inside its shaft.
    position.y += 0.005;
    position.z += 0.012;
    node.setLocalScale(scale.x * garmentScale, scale.y * garmentScale, scale.z);
    node.setLocalPosition(position);
    if (collision) { return; }
    for (const render of node.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        const material = rail.cloneMaterial(mesh.material);
        material.diffuse.set(...item.color);
        material.update();
        mesh.material = material;
      }
    }
  }
}
