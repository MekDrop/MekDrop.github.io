import grassSideUrl from "src/assets/game/tiles/grass-side.png";
import grassTopUrl from "src/assets/game/tiles/grass-top.png";
import grassTop2Url from "src/assets/game/tiles/grass-top-2.png";
import grassTop3Url from "src/assets/game/tiles/grass-top-3.png";
import grassTop4Url from "src/assets/game/tiles/grass-top-4.png";
import grassTop5Url from "src/assets/game/tiles/grass-top-5.png";
import grassTop6Url from "src/assets/game/tiles/grass-top-6.png";
import grassTerrainShader from "../../objects/ground-cover/GrassTerrain.frag?raw";
import { TileType } from "../../generator/map/MapGenerator.js";
import { FIXED_HEIGHTS } from "../../rendering/terrain/TerrainMaterialMaps.js";
import { tilePatchValue } from "../../rendering/terrain/TileVariantIndex.js";

const TOP_TEXTURES = ["grass", "grass2", "grass3", "grass4", "grass5", "grass6"];
// Narrow the meadow palette so paths and flowers lead the eye at gameplay zoom.
const TILE_COLORS = [0x70a044, 0x79aa4c, 0x638b3b, 0x7fa449, 0x70a044, 0x638b3b];
const TEXTURE_MIXES = [0.06, 0.065, 0.065, 0.06, 0.085, 0.07];
const LINEAR_COLORS = TILE_COLORS.map(/**
 *
 * @param {string} color
 */
(color) =>
  [16, 8, 0].map(/**
   *
   * @param {number} shift
   */
  (shift) => {
    const channel = ((color >> shift) & 0xff) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }),
);
const OPEN_VARIANT_THRESHOLDS = [0.53, 0.622, 0.697, 0.738, 0.825];
const SHADED_VARIANT_THRESHOLDS = [0.465, 0.525, 0.639, 0.67, 0.73];
const SIDE_COLORS = [0xffffff, 0xf9f5ee, 0xf2f7ed, 0xf8fbf5, 0xf5f1e9, 0xfbf8f2];

/**
 * @typedef {{startU?: number, startV?: number, scaleU?: number, scaleV?: number, flipU?: boolean, flipV?: boolean}} TextureTransform
 */

export class GrassSurfaceMaterials {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameMapData}
   */
  #mapData;
  /**
   * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition[]}
   */
  #vegetation;
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
    this.#vegetation = (mapData?.objects ?? []).filter(
      /**
       * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => definition.object === "Vegetation");
  }

  /**
   *
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return {
      grass: grassTopUrl,
      grass2: grassTop2Url,
      grass3: grassTop3Url,
      grass4: grassTop4Url,
      grass5: grassTop5Url,
      grass6: grassTop6Url,
      grassSide: grassSideUrl,
    };
  }

  /**
   *
   * @returns {Array}
   */
  static get tileColors() {
    return LINEAR_COLORS;
  }

  /**
   *
   * @param {typeof pc} pc
   * @param {string} name
   * @param {pc.Texture} texture
   * @param {Array} mipmaps
   */
  static configureTexture(pc, name, texture, mipmaps) {
    const topTexture = TOP_TEXTURES.includes(name);
    if (!topTexture) {
      return;
    }
    texture.mipmaps = topTexture && mipmaps;
    texture.minFilter = texture.mipmaps
      ? pc.FILTER_LINEAR_MIPMAP_LINEAR
      : pc.FILTER_NEAREST;
    texture.magFilter = pc.FILTER_NEAREST;
    texture.addressU = topTexture
      ? pc.ADDRESS_MIRRORED_REPEAT
      : pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = texture.addressU;
  }

  /**
   *
   * @param {pc.Material[]} materials
   * @param {(name: string, definition: import("src/game/GameContracts.js").MaterialDefinition) => pc.Material} createMaterial
   * @param {TextureTransform[]} sideTransforms
   */
  static register(materials, createMaterial, sideTransforms) {
    /**
     *
     * @param {string} name
     * @param {pc.Texture} texture
     * @param {number} index
     */
    const createTop = (name, texture, index) => {
      const material = createMaterial(name, {
        color: 0xffffff,
        texture,
        gloss: 0.05,
      });
      // The earth backing is only 0.2 mm below this surface. Keep turf ahead
      // in the depth buffer, including grazing first-person views, without
      // raising the geometry or changing the camera's close-wall clipping.
      material.depthBias = -2;
      material.slopeDepthBias = -1;
      material.shaderChunks.glsl.set("diffusePS", grassTerrainShader);
      material.setParameter("uGrassTileColor", LINEAR_COLORS[index]);
      material.setParameter("uGrassTextureMix", TEXTURE_MIXES[index]);
      material.update();
      materials.set(name, material);
    };
    createTop("grass", TOP_TEXTURES[0], 0);
    TOP_TEXTURES.forEach(/**
     *
     * @param {pc.Texture} texture
     * @param {number} index
     */
    (texture, index) => {
      createTop(`grass-${index}`, texture, index);
    });

    sideTransforms.forEach(/**
     *
     * @param {pc.Mat4} transform
     * @param {number} index
     */
    (transform, index) => {
      const name = `grassSide-${index}`;
      materials.set(
        name,
        createMaterial(name, {
          texture: "grassSide",
          color: SIDE_COLORS[index],
          gloss: 0.05,
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
  topForTile(col, row, level) {
    return `grass-${this.variantForTile(col, row, level)}`;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  variantForTile(col, row, level) {
    const thresholds = this.#isShaded(col, row, level)
      ? SHADED_VARIANT_THRESHOLDS
      : OPEN_VARIANT_THRESHOLDS;
    const value = tilePatchValue(col, row, level);
    for (let index = 0; index < thresholds.length; index += 1) {
      if (value < thresholds[index]) {
        return index;
      }
    }
    return thresholds.length;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   */
  #tileHeight(col, row) {
    const type = this.#mapData.grid[row][col];
    return type in FIXED_HEIGHTS
      ? FIXED_HEIGHTS[type]
      : this.#mapData.heightmap[row][col];
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} level
   */
  #isShaded(col, row, level) {
    const { grid, castle, castles } = this.#mapData;
    const nearStructure = (
      castles?.length ? castles : castle ? [castle] : []
    ).some(
      /**
       *
       * @param {{position: pc.Vec3}} options
       * @param {pc.Vec3} options.position
       */
      ({ position }) =>
        col >= position.col - 2 &&
        col < position.col + position.width + 2 &&
        row >= position.row - 2 &&
        row < position.row + position.depth + 2,
    );
    if (nearStructure) {
      return true;
    }
    if (
      this.#vegetation.some(/**
       *
       * @param {{object: import("src/game/GameContracts.js").GameObjectContract, tile: import("src/game/GameContracts.js").TileMetadata, kind: string}} options
       * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
       * @param {import("src/game/GameContracts.js").TileMetadata} options.tile
       * @param {string} options.kind
       */
      ({ object, tile, kind }) => {
        if (object !== "Vegetation" || !tile) {
          return false;
        }
        return (
          Math.max(Math.abs(col - tile.col), Math.abs(row - tile.row)) <=
          (kind === "tree" ? 2 : 1)
        );
      })
    ) {
      return true;
    }
    for (const [dc, dr] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighborCol = col + dc;
      const neighborRow = row + dr;
      if (grid[neighborRow]?.[neighborCol] === undefined) {
        return true;
      }
      const neighborType = grid[neighborRow][neighborCol];
      if (
        neighborType === TileType.CASTLE_WALL ||
        neighborType === TileType.CASTLE_TOWER ||
        this.#tileHeight(neighborCol, neighborRow) < level + 0.5
      ) {
        return true;
      }
    }
    return false;
  }
}
