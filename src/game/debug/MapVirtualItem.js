import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { VirtualItemObjectNotSupportedError } from "../errors/debug/index.js";
import {
  GROUND_COVER_VARIANTS,
  GroundCoverItem,
} from "../objects/ground-cover/index.js";

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
  #definition;
  #item;
  #variantDefinition;

  constructor({ pc, app, modelLibrary, definition }) {
    if (definition.object !== GroundCoverItem.name) {
      throw new VirtualItemObjectNotSupportedError({
        object: definition.object,
      });
    }
    this.#definition = definition;
    this.#variantDefinition = GROUND_COVER_VARIANTS[definition.variant];
    const position = definition.position;
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

  get entity() {
    return this.#item.entity;
  }

  get variantDefinition() {
    return this.#variantDefinition;
  }

  get visualRoots() {
    return [this.#item.entity];
  }

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
