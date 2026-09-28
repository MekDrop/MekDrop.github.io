import { DuplicateGameCanvasPluginError } from "../../errors/plugins/index.js";

/**
 * @typedef {{install: () => void, destroy: () => void, resize?: () => void, beforeRender?: () => void, afterRender?: (mapData: object) => void}} GameCanvasPlugin
 */

/**
 * @typedef {new (context: object, entry: object) => GameCanvasPlugin} GameCanvasPluginConstructor
 */

/**
 * @typedef {{install: () => void, destroy: () => void, resize?: () => void, beforeRender?: () => void, afterRender?: (mapData: object) => void}} GameCanvasPlugin
 */

/**
 * @typedef {new (context: object, entry: object) => GameCanvasPlugin} GameCanvasPluginConstructor
 */

export class GameCanvasPluginRegistry {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {Map}
   */
  #entries = new Map();
  /**
   *
   * @type {Array}
   */
  #pluginModules;
  /**
   *
   * @type {Map}
   */
  #plugins = new Map();
  /**
   *
   * @type {string}
   */
  #state = {};
  /**
   *
   * @type {boolean}
   */
  #destroyed = false;

  /**
   *
   * @param {{target: EventTarget|pc.Entity, pluginModules: Record<string, () => Promise<Record<string, GameCanvasPluginConstructor>>>, container: pc.Entity, renderer: PlayCanvasRenderer, route: import("src/game/GameContracts.js").RouteLocation, router: import("src/game/GameContracts.js").RouterContract, nextTick: () => Promise<void>, mapRouteLocation: import("src/game/GameContracts.js").RouteLocation, loadMapRoute: () => Promise<() => Promise<import("src/game/GameContracts.js").RouteLocation>>, mapRouteLoadPromise: Promise<import("src/game/GameContracts.js").RouteLocation>|null, setMapRouteLoadPromise: (promise: Promise<(promise: Promise<import("src/game/GameContracts.js").RouteLocation>|null) => void>) => void, registerControlAction: (action: import("src/game/GameContracts.js").GameActionContract) => (() => void), debugStore: import("src/game/GameContracts.js").StoreContract}} options
   * @param {EventTarget|pc.Entity} options.target
   * @param {Record<string, () => Promise<Record<string, GameCanvasPluginConstructor>>>} options.pluginModules
   * @param {pc.Entity} options.container
   * @param {PlayCanvasRenderer} options.renderer
   * @param {import("src/game/GameContracts.js").RouteLocation} options.route
   * @param {import("src/game/GameContracts.js").RouterContract} options.router
   * @param {() => Promise<void>} options.nextTick
   * @param {import("src/game/GameContracts.js").RouteLocation} options.mapRouteLocation
   * @param {() => Promise<() => Promise<import("src/game/GameContracts.js").RouteLocation>>} options.loadMapRoute
   * @param {Promise<import("src/game/GameContracts.js").RouteLocation>|null} options.mapRouteLoadPromise
   * @param {(promise: Promise<(promise: Promise<import("src/game/GameContracts.js").RouteLocation>|null) => void>) => void} options.setMapRouteLoadPromise
   * @param {(action: import("src/game/GameContracts.js").GameActionContract) => (() => void)} options.registerControlAction
   * @param {import("src/game/GameContracts.js").StoreContract} options.debugStore
   */
  constructor({
    target,
    pluginModules,
    container,
    renderer,
    route,
    router,
    nextTick,
    mapRouteLocation,
    loadMapRoute,
    mapRouteLoadPromise,
    setMapRouteLoadPromise,
    registerControlAction,
    debugStore,
  }) {
    /**
     *
     * @type {Array}
     */
    this.#pluginModules =
      pluginModules ??
      import.meta.glob("/src/game/plugins/game-canvas/**/*Plugin.js");
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = {
      target,
      container,
      renderer,
      route,
      router,
      nextTick,
      mapRouteLocation,
      loadMapRoute,
      mapRouteLoadPromise,
      setMapRouteLoadPromise,
      registerControlAction,
      debugStore,
    };
  }

  /**
   *
   * @param {Array} entries
   */
  configure(entries) {
    this.#entries.clear();
    for (const entry of entries) {
      const id = entry.exportName;
      if (this.#entries.has(id)) {
        throw new DuplicateGameCanvasPluginError(id);
      }
      this.#entries.set(id, entry);
    }
  }

  async refresh() {
    if (this.#destroyed) {
      return;
    }

    for (const [id, entry] of this.#entries) {
      const enabled = this.#isEnabled(entry);
      if (!enabled) {
        this.unload(id);
        continue;
      }
      if (this.#plugins.has(id)) {
        continue;
      }

      if (this.#destroyed || !this.#isEnabled(entry)) {
        continue;
      }

      const pluginModule = await this.#pluginModules[entry.module]();
      if (this.#destroyed || !this.#isEnabled(entry)) {
        continue;
      }
      const PluginClass = pluginModule[entry.exportName];
      const plugin = new PluginClass(this.#context, entry);
      this.#plugins.set(id, plugin);
      try {
        plugin.install();
      } catch (error) {
        this.#plugins.delete(id);
        throw error;
      }
    }
  }

  /**
   *
   * @param {string} id
   */
  get(id) {
    return this.#plugins.get(id) ?? null;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  setState(state) {
    Object.assign(this.#state, state);
  }

  /**
   *
   * @param {string} id
   */
  unload(id) {
    const plugin = this.#plugins.get(id);
    if (!plugin) {
      return;
    }

    this.#plugins.delete(id);
    plugin.destroy();
  }

  destroy() {
    this.#destroyed = true;
    for (const id of [...this.#plugins.keys()]) {
      this.unload(id);
    }
  }

  resize() {
    for (const plugin of this.#plugins.values()) {
      plugin.resize?.();
    }
  }

  beforeRender() {
    for (const plugin of this.#plugins.values()) {
      plugin.beforeRender?.();
    }
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  afterRender(mapData) {
    for (const plugin of this.#plugins.values()) {
      plugin.afterRender?.(mapData);
    }
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameCanvasPluginEntry} entry
   */
  #isEnabled(entry) {
    const hasRequiredState = Object.entries(entry.requires ?? {}).every(
      /**
       *
       * @param {{"0": number, "1": number}} options
       * @param {number} options."0"
       * @param {number} options."1"
       */
      ([key, value]) => this.#state[key] === value,
    );
    if (!hasRequiredState) {
      return false;
    }
    if (!entry.queryParameter) {
      return true;
    }
    return new URLSearchParams(
      this.#context.target.location?.search ?? "",
    ).has(entry.queryParameter);
  }
}
