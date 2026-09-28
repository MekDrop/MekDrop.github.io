import pathSideUrl from "src/assets/game/tiles/path-sandstone-side.png";
import pathTopUrl from "src/assets/game/tiles/path-sandstone-top.png";
import pathSurfaceFragmentShader from "./PathSurface.frag?raw";

const TOP_VARIANTS = [
  { color: 0xf3ddc1 },
  { color: 0xe9d1b2, scaleU: 1, scaleV: 1, flipU: true },
  { color: 0xf9e5cd, scaleU: 1, scaleV: 1, flipV: true },
  { color: 0xddc7ab, scaleU: 1, scaleV: 1, flipU: true, flipV: true, wear: 0.12 },
  { color: 0xe5d9c6, scaleU: 1, scaleV: 1, flipV: true },
];
const TOP_VARIANT_WEIGHTS = [0, 0, 1, 0, 2, 3, 4, 0];
const SIDE_COLORS = [0xead8b9, 0xe2ceb0, 0xecd5b4, 0xdcc6a7, 0xe8d1b0, 0xdfc9a9];

/**
 * @typedef {{startU?: number, startV?: number, scaleU?: number, scaleV?: number, flipU?: boolean, flipV?: boolean}} TextureTransform
 */

export class PathSurfaceMaterials {
  /**
   *
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return { path: pathTopUrl, pathSide: pathSideUrl };
  }

  /**
   *
   * @param {pc.Material[]} materials
   * @param {(name: string, definition: import("src/game/GameContracts.js").MaterialDefinition) => pc.Material} createMaterial
   * @param {TextureTransform[]} sideTransforms
   */
  static register(materials, createMaterial, sideTransforms) {
    TOP_VARIANTS.forEach(/**
     *
     * @param {string} variant
     * @param {number} index
     */
    (variant, index) => {
      const name = index === 0 ? "path" : `path-${index}`;
      const material = createMaterial(name, {
        texture: "path",
        gloss: 0.03,
        ...variant,
      });
      material.shaderChunks.glsl.set("diffusePS", pathSurfaceFragmentShader);
      material.setParameter("uPathWear", variant.wear ?? 0);
      material.setParameter("uPathWearCenter", new Float32Array([0.18, 0.2]));
      material.update();
      materials.set(name, material);
    });

    sideTransforms.forEach(/**
     *
     * @param {pc.Mat4} transform
     * @param {number} index
     */
    (transform, index) => {
      const name = `pathSide-${index}`;
      materials.set(
        name,
        createMaterial(name, {
          texture: "pathSide",
          color: SIDE_COLORS[index],
          gloss: 0.04,
          ...transform,
        }),
      );
    });
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  static topForTile(col, row, level) {
    const hash =
      Math.imul(col + 17, 73856093) ^
      Math.imul(row + 31, 19349663) ^
      Math.imul(level + 7, 83492791) ^
      59;
    const weight = (hash >>> 0) % TOP_VARIANT_WEIGHTS.length;
    const variant = TOP_VARIANT_WEIGHTS[weight];
    return variant === 0 ? "path" : `path-${variant}`;
  }
}
