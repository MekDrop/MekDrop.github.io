import { CastleEntityBuilder } from "./CastleEntityBuilder.js";
import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";

export { isCastleUpperFloorRoomVoid } from "../../generator/castle/CastleGeometry.js";

export class Castle extends CastleEntityBuilder {
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition}
   */
  #definition;

  /**
   *
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
      fireParticleTexture: textureAssets.get("castleFireParticle").resource,
      onRuntimeError: runtime.onRuntimeError,
    });
    this.#definition = definition;
    this.entity.tags.add("map-object", definition.id, this.constructor.name);
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
