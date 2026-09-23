export class SceneObjectRegistry {
  #objects = new Map();
  #keysByType = new Map();
  #countsByType = new Map();

  setOne(type, object) {
    this.#forgetType(type);
    this.#objects.set(type, object);
    this.#keysByType.set(type, [type]);
    this.#countsByType.set(type, 1);
    return type;
  }

  add(type, object) {
    const key = this.#nextCollectionKey(type);
    this.#objects.set(key, object);
    const keys = this.#keysByType.get(type) ?? [];
    keys.push(key);
    this.#keysByType.set(type, keys);
    return key;
  }

  get(key) {
    return this.#objects.get(key) ?? null;
  }

  getOne(type) {
    return this.get(type);
  }

  getFirst(type) {
    const keys = this.#keysByType.get(type) ?? [];
    return this.get(keys[0]);
  }

  getAll(type) {
    return (this.#keysByType.get(type) ?? [])
      .map((key) => this.get(key))
      .filter(Boolean);
  }

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

  #nextCollectionKey(type) {
    const count = this.#countsByType.get(type) ?? 0;
    this.#countsByType.set(type, count + 1);
    return `${type}_${count}`;
  }

  #forgetType(type) {
    for (const key of this.#keysByType.get(type) ?? []) {
      this.#objects.delete(key);
    }
    this.#objects.delete(type);
    this.#keysByType.delete(type);
    this.#countsByType.delete(type);
  }
}
