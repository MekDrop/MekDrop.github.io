import { DuplicateGameCanvasPluginError } from "../../errors/plugins/index.js";

export class GameCanvasPluginRegistry {
  #context;
  #entries = new Map();
  #pluginModules;
  #plugins = new Map();
  #state = {};
  #destroyed = false;

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
    this.#pluginModules =
      pluginModules ??
      import.meta.glob("/src/game/plugins/game-canvas/**/*Plugin.js");
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

  get(id) {
    return this.#plugins.get(id) ?? null;
  }

  setState(state) {
    Object.assign(this.#state, state);
  }

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

  afterRender(mapData) {
    for (const plugin of this.#plugins.values()) {
      plugin.afterRender?.(mapData);
    }
  }

  #isEnabled(entry) {
    const hasRequiredState = Object.entries(entry.requires ?? {}).every(
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
