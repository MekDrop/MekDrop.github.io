export class HudCollection extends Map {
  /**
   * @type {Map<string, Record<string, never>>}
   */
  #options = new Map();
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
    this.#options.set(key, options);

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
    this.#options.delete(key);
    hud.destroy();

    return true;
  }

  /**
   * Replace one HUD while keeping its input dependencies and displayed state.
   * Build before retiring the old HUD so a failed update leaves it usable.
   * @param {typeof import("./GamePanelHud.js").GamePanelHud} HudClass
   * @returns {boolean}
   */
  reloadDevelopment(HudClass) {
    const previous = this.getHud(HudClass);
    if (!previous) {
      return false;
    }
    const next = new HudClass({
      ...this.#options.get(HudClass.name),
      pc: this.#pc,
      app: this.#app,
    });
    try {
      next.developmentState = previous.developmentState;
      next.visible = previous.entity?.enabled ?? true;
      next.attach();
    } catch (error) {
      next.destroy();
      throw error;
    }
    previous.destroy();
    this.set(HudClass.name, next);

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
    this.#options.clear();
    this.#pc = null;
    this.#app = null;
  }
}
