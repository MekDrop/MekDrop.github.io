import earthSideUrl from "src/assets/game/tiles/earth-side.png";
import grassSideShader from "../../objects/ground-cover/GrassSide.frag?raw";
import grassTurfSideShader from "../../objects/ground-cover/GrassTurfSide.frag?raw";
import { EARTH_TEXTURE_COLORS } from "../../config/terrain.js";
import { shadeHexColor } from "../../helpers/colors.js";

const DEPTH_SHADES = [
  1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.53, 0.47, 0.42, 0.38,
];
const HIGHEST_SIDE_LEVEL = 1;

/**
 * @typedef {{startU?: number, startV?: number, scaleU?: number, scaleV?: number, flipU?: boolean, flipV?: boolean}} TextureTransform
 */

/**
 * @typedef {{startU?: number, startV?: number, scaleU?: number, scaleV?: number, flipU?: boolean, flipV?: boolean}} TextureTransform
 */

export class EarthSurfaceMaterials {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameMapData}
   */
  #mapData;

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  constructor(mapData) {
    /**
     *
     * @type {import("src/game/GameContracts.js").GameMapData}
     */
    this.#mapData = mapData;
  }

  /**
   *
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return { earthSide: earthSideUrl };
  }

  /**
   *
   * @param {pc.Material[]} materials
   * @param {(name: string, definition: import("src/game/GameContracts.js").MaterialDefinition) => pc.Material} createMaterial
   * @param {TextureTransform[]} sideTransforms
   */
  static register(materials, createMaterial, sideTransforms) {
    for (const [name, definition] of Object.entries({
      earth: { color: 0xe8c4a0, texture: "earthSide", gloss: 0.08 },
      islandRock: { color: 0x667482, texture: "earthSide", gloss: 0.03 },
    })) {
      materials.set(name, createMaterial(name, definition));
    }

    DEPTH_SHADES.forEach(/**
     *
     * @param {string} shade
     * @param {number} depth
     */
    (shade, depth) => {
      EARTH_TEXTURE_COLORS.forEach(/**
       *
       * @param {string} color
       * @param {string} variant
       */
      (color, variant) => {
        const bridgeSideTexture = {
          ...sideTransforms[variant],
          startV: 0.4,
          scaleV: 0.6,
        };
        const base = {
          color: shadeHexColor(color, shade),
          texture: "grassSide",
          gloss: 0.05,
          ...bridgeSideTexture,
        };
        for (const [name, shader] of [
          [`grassEarthSide-depth-${depth}-${variant}`, grassSideShader],
          [`grassTopSide-depth-${depth}-${variant}`, grassTurfSideShader],
        ]) {
          const material = createMaterial(name, base);
          material.shaderChunks.glsl.set("diffusePS", shader);
          material.update();
          materials.set(name, material);
        }

        const overpassName = `overpassEarthSide-depth-${depth}-${variant}`;
        materials.set(
          overpassName,
          createMaterial(overpassName, {
            color: shadeHexColor(0xffffff, shade),
            texture: "grassSide",
            gloss: 0.05,
            ...bridgeSideTexture,
          }),
        );
      });
    });
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  sideForTile(col, row, level) {
    return `grassEarthSide-depth-${this.#depth(level)}-${this.#variant(col, row, level)}`;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  topSideForTile(col, row, level) {
    return `grassTopSide-depth-${this.#depth(level)}-${this.#variant(col, row, level)}`;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  overpassSideForTile(col, row, level) {
    return `overpassEarthSide-depth-${this.#depth(level)}-${this.#variant(col, row, level)}`;
  }

  /**
   *
   * @param {number} level
   */
  #depth(level) {
    return Math.max(
      0,
      Math.min(DEPTH_SHADES.length - 1, HIGHEST_SIDE_LEVEL - Math.floor(level)),
    );
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  #variant(col, row, level) {
    const selection = this.#mapData.earthTextureVariants;
    return selection?.tiles[row]?.[col]?.[Math.floor(level) - selection.firstLevel] ?? 0;
  }
}
