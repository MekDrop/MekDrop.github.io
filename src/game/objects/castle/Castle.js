import { CastleEntityBuilder } from "./CastleEntityBuilder.js";
import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";

export { isCastleUpperFloorRoomVoid } from "../../generator/castle/CastleGeometry.js";

export class Castle extends CastleEntityBuilder {
  #definition;

  static get modelUrls() {
    return CastleEntityBuilder.modelUrls;
  }

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

  get sceneObjectType() {
    return SCENE_OBJECT_TYPE.CASTLE;
  }

  get isGroundCollider() {
    return true;
  }

  get visualRoots() {
    return [this.entity];
  }
}
