import carpetTextureUrl from "src/assets/game/textures/castle-carpet.png";
import { CastleEntityBuilder } from "./CastleEntityBuilder.js";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";

export { isCastleUpperFloorRoomVoid } from "../../generator/castle/CastleGeometry.js";

export class Castle extends CastleEntityBuilder {
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition}
   */
  #definition;

  /**
   * @type {number}
   */
  #islandGroup = -1;

  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() {
    return { castleCarpet: carpetTextureUrl };
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
      carpetTexture: textureAssets.get("castleCarpet").resource,
      fireParticleTexture: textureAssets.get("castleFireParticle").resource,
      onRuntimeError: runtime.onRuntimeError,
    });
    this.#definition = definition;
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
