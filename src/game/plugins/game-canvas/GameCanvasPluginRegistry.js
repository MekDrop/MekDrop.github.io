export class GameCanvasPluginRegistry {
  #context;
  #plugins = new Map();

  constructor({
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
    uiTheme,
  }) {
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
      uiTheme,
    };
  }

  load(PluginClass) {
    const loadedPlugin = this.#plugins.get(PluginClass);
    if (loadedPlugin) {
      return loadedPlugin;
    }

    const plugin = new PluginClass(this.#context);
    this.#plugins.set(PluginClass, plugin);
    try {
      plugin.install();
    } catch (error) {
      this.#plugins.delete(PluginClass);
      throw error;
    }
    return plugin;
  }

  unload(PluginClass) {
    const plugin = this.#plugins.get(PluginClass);
    if (!plugin) {
      return;
    }

    this.#plugins.delete(PluginClass);
    plugin.destroy();
  }

  destroy() {
    for (const PluginClass of [...this.#plugins.keys()]) {
      this.unload(PluginClass);
    }
  }

  resize() {
    for (const plugin of this.#plugins.values()) {
      plugin.resize?.();
    }
  }
}
