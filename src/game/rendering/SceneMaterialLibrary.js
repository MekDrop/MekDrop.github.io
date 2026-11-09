import { woodTexture } from "../textures/shared-textures.js";
import { MapObjectFactory } from "../objects/MapObjectFactory.js";
import { PathSurfaceMaterials } from "./terrain/PathSurfaceMaterials.js";
import { colorFromHex } from "../helpers/colors.js";

const MATERIAL_DEFINITIONS = {
  water: {
    color: 0xd8f2ff,
    texture: "water",
    gloss: 0.22,
  },
};

const SIDE_VARIANT_DEFINITIONS = {
  waterSide: {
    texture: "waterSide",
    colors: [0xd8f2ff, 0xcfeaff, 0xe0f5ff, 0xc9e7ff, 0xd5efff, 0xdff7ff],
    gloss: 0.18,
  },
};

const SIDE_VARIANT_TRANSFORMS = [
  {
    startU: 0,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0.14,
    scaleU: 0.72,
    flipU: true,
  },
  {
    startU: 0.28,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0,
    scaleU: 0.72,
    flipU: true,
  },
  {
    startU: 0.14,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0.28,
    scaleU: 0.72,
    flipU: true,
  },
];

/**
 * Owns shared scene materials and borrows named assets from the texture library.
 * Maps persist across scene replacements; consumers must not destroy their entries.
 */
export class SceneMaterialLibrary {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../textures/GameTextureLibrary.js").GameTextureLibrary}
   */
  #textureLibrary;
  /**
   * @type {{mipmaps:boolean, anisotropy:number}}
   */
  #graphicsSettingsStore;
  /**
   * @type {Map<string, import("playcanvas").StandardMaterial>}
   */
  #materials = new Map();
  /**
   * @type {Map<string, import("playcanvas").Asset>}
   */
  #textureAssets = new Map();

  /**
   * @param {{pc:typeof import("playcanvas"), textureLibrary:import("../textures/GameTextureLibrary.js").GameTextureLibrary, graphicsSettings:{mipmaps:boolean, anisotropy:number}}} options
   */
  constructor({ pc, textureLibrary, graphicsSettings }) {
    this.#pc = pc;
    this.#textureLibrary = textureLibrary;
    this.#graphicsSettingsStore = graphicsSettings;
  }

  get materials() {
    return this.#materials;
  }

  get textureAssets() {
    return this.#textureAssets;
  }

  /**
   * @returns {number}
   */
  get sideVariantCount() {
    return SIDE_VARIANT_TRANSFORMS.length;
  }

  destroy() {
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    this.#textureAssets.clear();
  }

  /**
   * @param {Record<string,string>} textureUrls
   * @param {((url:string, completed:number, total:number)=>void)|null} onProgress
   */
  async load(textureUrls, onProgress = null) {
    await this.#textureLibrary.loadNamed(textureUrls, onProgress);
    /**
     * @type {Map<string, import("playcanvas").Texture>}
     */
    const textures = new Map();
    await Promise.all(
      Object.entries(textureUrls).map(/**
       *
       * @param {[string, string]} entry
       */
        async ([name, url]) => {
          textures.set(name, await this.#loadTexture(name, url));
        }),
    );
    for (const [name, asset] of this.#textureAssets) {
      textures.set(name, asset.resource);
    }
    for (const [name, definition] of Object.entries(MATERIAL_DEFINITIONS)) {
      this.#materials.set(
        name,
        this.#createMaterial(name, definition, textures),
      );
    }

    for (const [name, definition] of Object.entries(SIDE_VARIANT_DEFINITIONS)) {
      SIDE_VARIANT_TRANSFORMS.forEach(/**
       *
       * @param {typeof SIDE_VARIANT_TRANSFORMS[number]} transform
       * @param {number} index
       */
        (transform, index) => {
          const variantName = `${name}-${index}`;
          this.#materials.set(
            variantName,
            this.#createMaterial(
              variantName,
              {
                ...definition,
                ...transform,
                color: definition.colors[index],
              },
              textures,
            ),
          );
        });
    }

    MapObjectFactory.registerMaterials(
      this.#materials,
      /**
       *
       * @param {string} name
       * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
       */
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
    PathSurfaceMaterials.register(
      this.#materials,
      /**
       *
       * @param {string} name
       * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
       */
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
  }

  /**
   *
   * @param {string} name
   * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
   * @param {Map<string, import("playcanvas").Texture>} textures
   */
  #createMaterial(name, definition, textures = new Map()) {
    const pc = this.#pc;
    const material = this.#materials.get(name) ?? new pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(pc, definition.color);
    material.gloss = definition.gloss ?? 0.08;
    material.metalness = 0;
    material.useMetalness = true;
    material.useLighting = definition.useLighting ?? true;
    if (definition.texture) {
      material.diffuseMap = textures.get(definition.texture) ?? null;
      if (definition.scaleU || definition.scaleV) {
        const scaleU = definition.scaleU ?? 1;
        const scaleV = definition.scaleV ?? 1;
        const tilingU = definition.flipU ? -scaleU : scaleU;
        const offsetU = definition.flipU
          ? (definition.startU ?? 0) + scaleU
          : (definition.startU ?? 0);
        const tilingV = definition.flipV ? -scaleV : scaleV;
        material.diffuseMapTiling = new pc.Vec2(tilingU, tilingV);
        material.diffuseMapOffset = new pc.Vec2(
          offsetU,
          definition.flipV
            ? 1 - (definition.startV ?? 0)
            : definition.startV === undefined
              ? 0
              : 1 - scaleV - definition.startV,
        );
      }
    }
    if (definition.emissive) {
      material.emissive = colorFromHex(pc, definition.emissive);
      material.emissiveIntensity = definition.emissiveIntensity ?? 0.45;
    }
    if (definition.opacity !== undefined) {
      material.opacity = definition.opacity;
      material.blendType = pc.BLEND_NORMAL;
      material.depthWrite = false;
    }
    material.update();

    return material;
  }

  /**
   *
   * @param {string} name
   * @param {string} url
   */
  async #loadTexture(name, url) {
    const pc = this.#pc;
    const asset = this.#textureLibrary.get(url, name);
    this.#textureAssets.set(name, asset);
    const texture = asset.resource;
    texture.mipmaps = this.#graphicsSettingsStore.mipmaps;
    texture.minFilter = texture.mipmaps
      ? pc.FILTER_LINEAR_MIPMAP_LINEAR
      : pc.FILTER_LINEAR;
    texture.magFilter =
      name === "castleStone" ? pc.FILTER_NEAREST : pc.FILTER_LINEAR;
    texture.anisotropy = this.#graphicsSettingsStore.anisotropy;
    texture.addressU = url === woodTexture.url ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV =
      name === "castleDoor" ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
    MapObjectFactory.configureTexture(
      pc,
      name,
      texture,
      this.#graphicsSettingsStore.mipmaps,
    );

    return texture;
  }

}
