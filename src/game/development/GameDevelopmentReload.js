import { GameHotReload } from "./GameHotReload.js";

/**
 * Coalesce a Vite update batch and serialize it with map navigation.
 * Loaded modules can change in every tab; only the active map is rebuilt.
 */
export class GameDevelopmentReload {
  /**
   * @type {DevelopmentReloadOptions}
   */
  #options;
  /**
   * @type {() => void}
   */
  #unsubscribe;
  /**
   * @type {ReturnType<typeof setTimeout>|null}
   */
  #timer = null;
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {Set<string>}
   */
  #objects = new Set();
  /**
   * @type {Set<string>}
   */
  #maps = new Set();
  /**
   * @type {Map<string, typeof import("../ui/GamePanelHud.js").GamePanelHud>}
   */
  #huds = new Map();
  /**
   * @type {Promise<void>}
   */
  #queue = Promise.resolve();

  /**
   * @param {DevelopmentReloadOptions} options
   */
  constructor(options) {
    this.#options = options;
    this.#unsubscribe = GameHotReload.subscribe(this.#receive.bind(this));
  }

  /**
   * @param {import("./GameHotReload.js").GameHotUpdate} update
   */
  #receive(update) {
    for (const name of update.objects ?? []) {
      this.#objects.add(name);
    }
    for (const name of update.maps ?? []) {
      this.#maps.add(name);
    }
    for (const Class of update.huds ?? []) {
      this.#huds.set(Class.name, Class);
    }
    clearTimeout(this.#timer);
    this.#timer = setTimeout(this.#schedule.bind(this), 60);
  }

  #schedule() {
    this.#timer = null;
    this.#queue = this.#queue.then(this.#apply.bind(this)).catch(this.#options.onError);
  }

  async #apply() {
    await this.#options.whenReady();
    if (this.#destroyed) {
      return;
    }
    const names = new Set(this.#objects);
    const maps = new Set(this.#maps);
    const huds = [...this.#huds.values()];
    this.#objects.clear();
    this.#maps.clear();
    this.#huds.clear();
    this.#options.reloadHuds(huds);
    const map = this.#options.getMap();
    if (!map) {
      return;
    }
    /**
     * @param {import("../objects/ObjectTypes.js").MapObjectDefinition} definition
     */
    const isAffected = (definition) => names.has(definition.object);
    const mapChanged = maps.has(map.mapName);
    const objectsChanged = (map.objects ?? []).some(isAffected);
    if (mapChanged || (objectsChanged && !await this.#options.reloadObjects([...names]))) {
      // Navigation may have begun while replacement assets were loading.
      await this.#options.whenReady();
      if (!this.#destroyed && this.#options.getMap() === map) {
        await this.#options.reloadMap(map.mapName);
      }
    }
  }

  destroy() {
    this.#destroyed = true;
    clearTimeout(this.#timer);
    this.#unsubscribe();
    this.#objects.clear();
    this.#maps.clear();
    this.#huds.clear();
  }
}

/**
 * @typedef {object} DevelopmentReloadOptions
 * @property {() => Promise<void>} whenReady
 * @property {() => import("../objects/ObjectTypes.js").GameMapData|null} getMap
 * @property {(names: string[]) => Promise<boolean>} reloadObjects
 * @property {(classes: Array<typeof import("../ui/GamePanelHud.js").GamePanelHud>) => void} reloadHuds
 * @property {(name: string) => Promise<void>} reloadMap
 * @property {(error: Error) => void} onError
 */
