import { Color, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, version } from "playcanvas";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";
import diffuseShader from "./BedPatches.frag?raw";
import diffuseWgslShader from "./BedPatches.wgsl?raw";

/**
 * Selects individual repair-cloth colors in the authored blanket atlas.
 * The original cloth folds, stitches, pillow and timber remain authored data.
 */
export class BedPatchMaterial {
  /**
   * @param {string|number} seed
   * @returns {number[][]}
   */
  static variation(seed) {
    const random = new GenerationRandom(`${seed}:blanket-repairs`);
    const palette = [[0.69, 0.57, 0.39], [0.42, 0.52, 0.36], [0.58, 0.32, 0.26],
      [0.34, 0.45, 0.59], [0.52, 0.45, 0.56], [0.77, 0.73, 0.61]];

    return Array.from({ length: 4 }, () => [...random.randomItem(palette)]);
  }

  /**
   * @param {import("playcanvas").StandardMaterial} material
   * @param {string|number} seed
   */
  static configure(material, seed) {
    material.shaderChunksVersion = version.split(".").slice(0, 2).join(".");
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set("diffusePS", diffuseShader);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set("diffusePS", diffuseWgslShader);
    for (const [index, color] of BedPatchMaterial.variation(seed).entries()) {
      material.setParameter(`uBedRepair${index}`, new Color(...color).linear().toArray([], 0, false));
    }
    material.update();
  }
}
