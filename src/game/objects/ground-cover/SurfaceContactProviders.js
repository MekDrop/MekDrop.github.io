/**
 * Caches provider membership while reading current physics contacts every frame.
 */
export class SurfaceContactProviders {
  /**
   * @type {import("../../rendering/scene/SceneObjectRegistry.js").SceneObjectRegistry}
   */
  #objects;
  /**
   * @type {() => import("../../GameContracts.js").GameObjectContract[]}
   */
  #getAdditional;
  /**
   * @type {number}
   */
  #revision = -1;
  /**
   * @type {import("../../GameContracts.js").GameObjectContract[]}
   */
  #providers = [];
  /**
   * @param {import("../../rendering/scene/SceneObjectRegistry.js").SceneObjectRegistry} objects
   * @param {() => import("../../GameContracts.js").GameObjectContract[]} getAdditional
   */
  constructor(objects, getAdditional) {
    this.#objects = objects;
    this.#getAdditional = getAdditional;
  }
  /**
   * @returns {Array<{x: number, y: number, z: number, radius: number}>}
   */
  get contacts() {
    if (
      this.#objects.revision === undefined || this.#revision !== this.#objects.revision
    ) {
      this.#revision = this.#objects.revision;
      this.#providers = [...this.#objects].filter(
        SurfaceContactProviders.#filterObject,
      );
    }
    return [...new Set([...this.#providers, ...this.#getAdditional()])].flatMap(
      SurfaceContactProviders.#flatMapObject,
    );
  }

  /**
   * @param {import("../../GameContracts.js").GameObjectContract} object
   */
  static #filterObject(object) {
    return object && "grassSurfaceContacts" in object;
  }

  /**
   * @param {import("../../GameContracts.js").GameObjectContract} object
   */
  static #flatMapObject(object) {
    return object?.grassSurfaceContacts ?? [];
  }
}
