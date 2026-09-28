export class SceneObjectRegistry {
  /**
   *
   * @type {Map}
   */
  #objects = new Map();
  /**
   *
   * @type {Map}
   */
  #keysByType = new Map();
  /**
   *
   * @type {Map}
   */
  #countsByType = new Map();

  /**
   *
   * @param {string} type
   * @param {import("src/game/GameContracts.js").GameObjectContract} object
   */
  setOne(type, object) {
    this.#forgetType(type);
    this.#objects.set(type, object);
    this.#keysByType.set(type, [type]);
    this.#countsByType.set(type, 1);
    return type;
  }

  /**
   *
   * @param {string} type
   * @param {import("src/game/GameContracts.js").GameObjectContract} object
   */
  add(type, object) {
    const key = this.#nextCollectionKey(type);
    this.#objects.set(key, object);
    const keys = this.#keysByType.get(type) ?? [];
    keys.push(key);
    this.#keysByType.set(type, keys);
    return key;
  }

  /**
   *
   * @param {string} key
   */
  get(key) {
    return this.#objects.get(key) ?? null;
  }

  /**
   *
   * @param {string} type
   */
  getOne(type) {
    return this.get(type);
  }

  /**
   *
   * @param {string} type
   */
  getFirst(type) {
    const keys = this.#keysByType.get(type) ?? [];
    return this.get(keys[0]);
  }

  /**
   *
   * @param {string} type
   */
  getAll(type) {
    return (this.#keysByType.get(type) ?? [])
      .map(/**
       *
       * @param {string} key
       */
      (key) => this.get(key))
      .filter(Boolean);
  }

  *[Symbol.iterator]() {
    yield* this.#objects.values();
  }

  /**
   *
   * @param {string} type
   */
  destroyType(type) {
    for (const object of this.getAll(type)) {
      object.destroy?.();
    }
    this.#forgetType(type);
  }

  clear() {
    this.#objects.clear();
    this.#keysByType.clear();
    this.#countsByType.clear();
  }

  /**
   *
   * @param {string} type
   */
  #nextCollectionKey(type) {
    const count = this.#countsByType.get(type) ?? 0;
    this.#countsByType.set(type, count + 1);
    return `${type}_${count}`;
  }

  /**
   *
   * @param {string} type
   */
  #forgetType(type) {
    for (const key of this.#keysByType.get(type) ?? []) {
      this.#objects.delete(key);
    }
    this.#objects.delete(type);
    this.#keysByType.delete(type);
    this.#countsByType.delete(type);
  }
}
