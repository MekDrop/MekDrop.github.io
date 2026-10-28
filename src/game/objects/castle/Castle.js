import { CastleSwapEffect } from "./CastleSwapEffect.js";
import { CastleGenerator } from "../../generator/castle/CastleGenerator.js";
import { CastleMapPreparation } from "./ground/CastleMapPreparation.js";
import gardenTextureUrl from "src/assets/game/tiles/grass-top.png";
import carpetTextureUrl from "src/assets/game/textures/castle-carpet.png";
import { woodTexture } from "../../textures/shared-textures.js";
import stoneTextureUrl from "src/assets/game/textures/castle-stone.png";
import { CastleEntityBuilder } from "./structure/CastleEntityBuilder.js";
import { FireplaceChimneySightline } from "../castle-props/fireplace/FireplaceChimneySightline.js";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";
import { CastleAudio } from "../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../audio/GameObjectAudio.js";

export { isCastleUpperFloorRoomVoid } from "../../generator/castle/CastleGeometry.js";

export class Castle extends CastleEntityBuilder {
  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [CastleAudio.transition, CastleAudio.transitionRelease, CastleAudio.doorOpen,
      CastleAudio.doorClose, CastleAudio.creak, CastleAudio.chop,
      CastleAudio.woodBreak].map(/**
       *
       * @param {{wavUrl:string,oggUrl:string}} source
       */
      (source) => source.wavUrl);
  }
  /**
   * Smooth the fine masonry pattern as the first-person camera moves.
   * @param {typeof import("playcanvas")} pc
   * @param {string} name
   * @param {import("playcanvas").Texture} texture
   */
  static configureTexture(pc, name, texture) {
    if (name === "castleStone") {
      texture.magFilter = pc.FILTER_LINEAR;
    }
  }
  /**
   * Smooth the fine masonry pattern as the first-person camera moves.
   * @param {typeof import("playcanvas")} pc
   * @param {string} name
   * @param {import("playcanvas").Texture} texture
   */
  static configureTexture(pc, name, texture) {
    if (name === "castleStone") {
      texture.magFilter = pc.FILTER_LINEAR;
    }
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
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #effectApp;

  /**
   * @type {number}
   */
  #islandGroup = -1;

  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return {
      castleDoor: woodTexture.url,
      castleStone: stoneTextureUrl,
      castleCarpet: carpetTextureUrl,
      castleGarden: gardenTextureUrl,
    };
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
      onRuntimeError: runtime.onRuntimeError,
    });

    this.#pc = pc;
    this.#effectApp = app;
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
    FireplaceChimneySightline.add(pc, app, this.entity, definition.buildPlan);
    for (const door of this.destructibleDoors) {
      door.audio = new GameObjectAudio(door.entity, app, runtime.audioLibrary, {
        open: CastleAudio.doorOpen,
        close: CastleAudio.doorClose,
        creak: CastleAudio.creak,
        hit: CastleAudio.chop,
        break: CastleAudio.woodBreak,
      }, 0.45);
      door.audio.follow(() => runtime.objects.getOne("hero")?.position ?? null);
    }
  }

  /**
   * Keep all castle parts on the same visual island as the authored footprint.
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.entity.setLocalPosition(0, offsets[this.#islandGroup] ?? 0, 0);
  }

  /**
   * @returns {Promise<number|null>}
   */
  regenerateRandomSeed() {
    let seed = Math.floor(Math.random() * 2147483647);
    if (seed === this.#definition.seed) {
      seed = (seed + 1) % 2147483647;
    }
    return this.regenerate(seed);
  }

  /**
   * Generate before replacing the live object; ignore concurrent or stale requests.
   * @param {number} seed
   * @returns {Promise<number|null>}
   */
  async regenerate(seed) {
    if (this.#regenerating || !this.entity) {
      return null;
    }
    this.#regenerating = true;
    let effect;
    try {
      effect = new CastleSwapEffect(this.#pc, this.#effectApp, this.#definition.buildPlan.input.position, this.entity, this.#runtime.audioLibrary);
      // Build during the mist fade-in instead of adding its duration to generation.
      const [buildPlan] = await Promise.all([
        CastleGenerator.generate({
          ...this.#definition,
          seed,
        }),
        new Promise(Castle.#waitForMist),
      ]);
      if (!this.entity) {
        return null;
      }
      const sign = this.#runtime.objects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
        .find(this.#findObject.bind(this));
      const previousText = sign?.definition.text;
      if (sign) {
        sign.text = `Seed ${seed}`;
      }
      const replaced = await this.#runtime.replaceObjectDefinition({
        ...this.#definition,
        seed,
        buildPlan,
      });
      if (!replaced && sign) {
        sign.text = previousText;
      }
      return replaced ? seed : null;
    } catch (error) {
      this.#runtime.onRuntimeError?.(error);

      return null;
    } finally {
      effect?.finish();
      await new Promise(/**
       *
       * @param {() => void} resolve
       */
        (resolve) => globalThis.setTimeout(resolve, 1700));
      effect?.destroy();
      this.#regenerating = false;
    }
  }

  /**
   * @param {() => void} resolve
   */
  static #waitForMist(resolve) {
    globalThis.setTimeout(resolve, 1200);
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

  /**
   *
   * @param {import("../ObjectTypes.js").MapObjectLike} object
   */
  #findObject(object) {
    return Boolean(this.#definition.seedSignId) &&
      object.definition?.id === this.#definition.seedSignId;
  }
}
