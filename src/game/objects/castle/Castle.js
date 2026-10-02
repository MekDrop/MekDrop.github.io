import { CastleGenerator } from "../../generator/castle/CastleGenerator.js";
import { CastleMapPreparation } from "./CastleMapPreparation.js";
import gardenTextureUrl from "src/assets/game/tiles/grass-top.png";
import carpetTextureUrl from "src/assets/game/textures/castle-carpet.png";
import { CastleEntityBuilder } from "./CastleEntityBuilder.js";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";

export { isCastleUpperFloorRoomVoid } from "../../generator/castle/CastleGeometry.js";

export class Castle extends CastleEntityBuilder {
  /**
   * Smooth the fine masonry pattern as the first-person camera moves.
   * @param {typeof import("playcanvas")} pc
   * @param {string} name
   * @param {import("playcanvas").Texture} texture
   */
  static configureTexture(pc, name, texture) {
    if (name === "castleStone") texture.magFilter = pc.FILTER_LINEAR;
  }
  /**
   * Smooth the fine masonry pattern as the first-person camera moves.
   * @param {typeof import("playcanvas")} pc
   * @param {string} name
   * @param {import("playcanvas").Texture} texture
   */
  static configureTexture(pc, name, texture) {
    if (name === "castleStone") texture.magFilter = pc.FILTER_LINEAR;
  }
  /**
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    CastleMapPreparation.prepareMap(mapData);
  }
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {import("../ObjectTypes.js").MapObjectRuntime}
   */
  #runtime;
  /**
   * @type {boolean}
   */
  #regenerating = false;


  /**
   * @type {number}
   */
  #islandGroup = -1;

  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return { castleCarpet: carpetTextureUrl, castleGarden: gardenTextureUrl };
  }

  /**
   * @returns {Array<string>}
   */
  static get modelUrls() {
    return CastleEntityBuilder.modelUrls;
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: string, definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition, runtime: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {string} options.modelLibrary
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {number} options.runtime
   */
  constructor({ pc, app, modelLibrary, definition, runtime }) {
    const textureAssets = runtime.textureAssets;
    super({
      pc,
      app,
      buildPlan: definition.buildPlan,
      modelLibrary,
      doorTexture: textureAssets.get("castleDoor").resource,
      stoneTexture: textureAssets.get("castleStone").resource,
      gardenTexture: textureAssets.get("castleGarden").resource,
      carpetTexture: textureAssets.get("castleCarpet").resource,
      fireParticleTexture: textureAssets.get("castleFireParticle").resource,
      onRuntimeError: runtime.onRuntimeError,
    });
    this.#definition = definition;
    this.#runtime = runtime;
    const { mapData } = runtime;
    const { x, z } = definition.buildPlan.input.position;
    const col = Math.floor(x + (mapData?.cols ?? 0) / 2);
    const row = Math.floor(z + (mapData?.rows ?? 0) / 2);
    this.#islandGroup = new IslandCellOwnership(mapData).groups.findIndex(
      /**
       * @param {Set<string>} cells
       */
      (cells) => cells.has(`${col},${row}`),
    );
    this.entity.tags.add("map-object", definition.id, this.constructor.name);
  }

  /**
   * Keep all castle parts on the same visual island as the authored footprint.
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    this.entity.setLocalPosition(0, [near, far][this.#islandGroup] ?? 0, 0);
  }

  /**
   * @returns {Promise<number|null>}
   */
  regenerateRandomSeed() {
    let seed = Math.floor(Math.random() * 2147483647);
    if (seed === this.#definition.seed) { seed = (seed + 1) % 2147483647; }
    return this.regenerate(seed);
  }

  /**
   * Generate before replacing the live object; ignore concurrent or stale requests.
   * @param {number} seed
   * @returns {Promise<number|null>}
   */
  async regenerate(seed) {
    if (this.#regenerating || !this.entity) { return null; }
    this.#regenerating = true;
    try {
      const buildPlan = await CastleGenerator.generate({ ...this.#definition, seed });
      if (!this.entity) { return null; }
      const sign = this.#runtime.objects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
        .find(/**
         *
         * @param {import("../ObjectTypes.js").MapObjectLike} object
         */
        (object) => object.definition?.id === this.#definition.seedSignId);
      const previousText = sign?.definition.text;
      if (sign) { sign.text = `Seed ${seed}`; }
      const replaced = this.#runtime.replaceObjectDefinition({ ...this.#definition, seed, buildPlan });
      if (!replaced && sign) { sign.text = previousText; }
      return replaced ? seed : null;
    } catch (error) {
      this.#runtime.onRuntimeError?.(error);
      return null;
    } finally {
      this.#regenerating = false;
    }
  }

  get definition() {
    return this.#definition;
  }

  /**
   *
    * @returns {string|number}
   */
  get sceneObjectType() {
    return SCENE_OBJECT_TYPE.CASTLE;
  }

  /**
   *
    * @returns {boolean}
   */
  get isGroundCollider() {
    return true;
  }

  /**
   *
    * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [this.entity];
  }
}
