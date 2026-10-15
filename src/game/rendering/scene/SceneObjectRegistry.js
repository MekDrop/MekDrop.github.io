export class SceneObjectRegistry {
  /**
   * @type {number}
   */
  #revision = 0;
  /**
   * @type {Map<string, import("src/game/GameContracts.js").GameObjectContract>|null}
   */
  #firstByClass = null;
  /**
   * @type {Map<string, import("src/game/GameContracts.js").GameObjectContract[]>}
   */
  #methodMembers = new Map();

  /**
   * Cache optional hook membership so frame dispatch does not scan terrain blocks.
   * @param {string} method
   * @returns {ReadonlyArray<import("src/game/GameContracts.js").GameObjectContract>}
   */
  getWithMethod(method) {
    if (!this.#methodMembers.has(method)) {
      this.#methodMembers.set(method, [...this.#objects.values()].filter(/**
       * @param {import("src/game/GameContracts.js").GameObjectContract} object
       */
        (object) => typeof object[method] === "function"));
    }
    return this.#methodMembers.get(method);
  }

  /**
   * @param {string} className
   * @returns {import("src/game/GameContracts.js").GameObjectContract|null}
   */
  getFirstByClass(className) {
    if (!this.#firstByClass) {
      this.#firstByClass = new Map();
      for (const object of this.#objects.values()) {
        if (!this.#firstByClass.has(object.constructor.name)) {
          this.#firstByClass.set(object.constructor.name, object);
        }
      }
    }
    return this.#firstByClass.get(className) ?? null;
  }
  /**
   * Changes when membership changes, including replacement at the same size.
   * @returns {number}
   */
  get revision() { return this.#revision; }
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
    this.#methodMembers.clear();
    this.#firstByClass = null;
    this.#revision++;
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
    this.#methodMembers.clear();
    this.#firstByClass = null;
    this.#revision++;
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
    this.#methodMembers.clear();
    this.#firstByClass = null;
    this.#revision++;
    for (const object of this.getAll(type)) {
      object.destroy?.();
    }
    this.#forgetType(type);
  }

  clear() {
    this.#methodMembers.clear();
    this.#firstByClass = null;
    this.#revision++;
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
