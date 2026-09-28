export class HudCollection extends Map {
  #pc;
  #app;

  constructor({ pc, app }) {
    super();
    this.#pc = pc;
    this.#app = app;
  }

  add(HudClass, options = {}) {
    const key = HudClass.name;
    const existingHud = this.get(key);
    if (existingHud) {
      return existingHud;
    }

    const hud = new HudClass({
      ...options,
      pc: this.#pc,
      app: this.#app,
    });
    this.set(key, hud);
    try {
      hud.attach();
    } catch (error) {
      this.delete(key);
      hud.destroy();
      throw error;
    }
    return hud;
  }

  getHud(HudClass) {
    return this.get(HudClass.name) ?? null;
  }

  remove(HudClass) {
    const key = HudClass.name;
    const hud = this.get(key);
    if (!hud) {
      return false;
    }

    this.delete(key);
    hud.destroy();
    return true;
  }

  update(deltaTime) {
    for (const hud of this.values()) {
      hud.update?.(deltaTime);
    }
  }

  destroy() {
    for (const hud of this.values()) {
      hud.destroy();
    }
    this.clear();
    this.#pc = null;
    this.#app = null;
  }
}
