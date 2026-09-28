export class HudCollection extends Map {
  /**
   * @type {typeof import("playcanvas")|null}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application|null}
   */
  #app;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   */
  constructor({ pc, app }) {
    super();
    this.#pc = pc;
    this.#app = app;
  }

  /**
   *
   * @param {typeof import("./GamePanelHud.js").GamePanelHud} HudClass
   * @param {Record<string, never>} options
   */
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

  /**
   *
   * @param {typeof import("./GamePanelHud.js").GamePanelHud} HudClass
   */
  getHud(HudClass) {
    return this.get(HudClass.name) ?? null;
  }

  /**
   *
   * @param {typeof import("./GamePanelHud.js").GamePanelHud} HudClass
   */
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

  /**
   *
   * @param {number} deltaTime
   */
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
