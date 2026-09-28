import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { VirtualItemObjectNotSupportedError } from "../errors/debug/index.js";
import {
  GROUND_COVER_VARIANTS,
  GroundCoverItem,
} from "../objects/ground-cover/index.js";

/**
 *
 * @param {import("src/game/GameContracts.js").GameObjectDefinition} definition
 */
function defaultScale(definition) {
  return definition.category === "flower"
    ? {
        x: definition.horizontalScale,
        y: definition.verticalScale,
        z: definition.horizontalScale,
      }
    : definition.scale;
}

/**
 * A non-interactive item placed directly by stored map data.
 */
export class MapVirtualItem {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameObjectDefinition}
   */
  #definition;
  /**
   *
   * @type {GroundCoverItem}
   */
  #item;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameObjectDefinition}
   */
  #variantDefinition;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, modelLibrary: GameModelLibrary, definition: import("src/game/GameContracts.js").GameObjectDefinition}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameModelLibrary} options.modelLibrary
   * @param {import("src/game/GameContracts.js").GameObjectDefinition} options.definition
   */
  constructor({ pc, app, modelLibrary, definition }) {
    if (definition.object !== GroundCoverItem.name) {
      throw new VirtualItemObjectNotSupportedError({
        object: definition.object,
      });
    }
    /**
     *
     * @type {import("src/game/GameContracts.js").GameObjectDefinition}
     */
    this.#definition = definition;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameObjectDefinition}
     */
    this.#variantDefinition = GROUND_COVER_VARIANTS[definition.variant];
    const position = definition.position;
    /**
     *
     * @type {GroundCoverItem}
     */
    this.#item = new GroundCoverItem({
      pc,
      app,
      modelLibrary,
      modelUrl: this.#variantDefinition.modelUrl,
      variant: definition.variant,
      x: position.x,
      y: position.y ?? GRASS_SURFACE_LIFT,
      z: position.z,
      rotation: definition.rotation ?? 0,
      scale: definition.scale ?? defaultScale(this.#variantDefinition),
      flexibility: this.#variantDefinition.flexibility ?? 0.82,
      stepReaction: "none",
      phase: definition.phase ?? 0,
      ambientMotion: definition.ambientMotion ?? 0.35,
    });
    this.#item.entity.name = `${definition.id} virtual item`;
    this.#item.entity.tags.add(
      "map-virtual-item",
      definition.id,
      definition.object,
      definition.variant,
    );
  }

  get definition() {
    return this.#definition;
  }

  /**
   *
   * @returns {pc.Entity}
   */
  get entity() {
    return this.#item.entity;
  }

  get variantDefinition() {
    return this.#variantDefinition;
  }

  /**
   *
   * @returns {Array}
   */
  get visualRoots() {
    return [this.#item.entity];
  }

  /**
   *
   * @param {number} deltaTime
   */
  advance(deltaTime) {
    this.#item.advance(deltaTime);
  }

  hide() {
    this.#item.entity.enabled = false;
  }

  reset() {
    this.#item.entity.enabled = true;
  }

  destroy() {
    this.#item.destroy();
    this.#item = null;
  }
}
