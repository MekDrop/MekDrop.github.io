import { GameAssetLoadError, GameAssetUnavailableError, GameAssetLibraryDestroyedError } from "../errors/assets/index.js";

/**
 * Shared loading, progress, and ownership for non-model PlayCanvas assets.
 * @abstract
 */
export class AbstractGameAssetLibrary {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").AssetRegistry}
   */
  #registry;
  /**
   * @type {string}
   */
  #type;
  /**
   * @type {Map<string, import("playcanvas").Asset>}
   */
  #assets = new Map();
  /**
   * @type {Map<string, Promise<void>>}
   */
  #loading = new Map();
  /**
   * @type {Map<string, (error: Error) => void>}
   */
  #rejects = new Map();
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {((url:string, completed:number, total:number) => void)|null}
   */
  #onProgress;
  /**
   * @type {import("playcanvas").Asset[]}
   */
  #queue = [];
  /**
   * @type {Set<import("playcanvas").Asset>}
   */
  #active = new Set();

  /**
   * @param {{pc:typeof import("playcanvas"), app:import("playcanvas").Application, type:string, onProgress?:((url:string, completed:number, total:number)=>void)|null}} options
   */
  constructor({ pc, app, type, onProgress = null }) {
    this.#pc = pc;
    this.#registry = app.assets;
    this.#type = type;
    this.#onProgress = onProgress;
  }

  /**
   * @param {Array<string|{url:string,key:string}>} urls
   * @param {((url:string, completed:number, total:number)=>void)|null} onProgress
   */
  async load(urls, onProgress = this.#onProgress) {
    const requests = new Map();
    for (const request of urls) {
      const url = typeof request === "string" ? request : request.url;
      const key = typeof request === "string" ? request : request.key;
      requests.set(key, url);
    }
    let completed = 0;
    await Promise.all([...requests].map(/**
     * @param {[string,string]} request
     */
      async ([key, url]) => {
        onProgress?.(url, completed, requests.size);
        await this.#request(url, key);
        completed++;
        onProgress?.(url, completed, requests.size);
      }));
  }

  /**
   * @param {string} url
   * @param {string} key
   * @returns {import("playcanvas").Asset}
   */
  get(url, key = url) {
    const asset = this.#assets.get(key);
    if (!asset?.loaded || !asset.resource) {
      throw new GameAssetUnavailableError({
        type: this.#type,
        url,
      });
    }
    return asset;
  }

  /**
   * @param {import("playcanvas").Asset} asset
   * @returns {boolean}
   */
  owns(asset) {
    return [...this.#assets.values()].includes(asset);
  }

  /**
   * @param {string} _url
   * @returns {Record<string, boolean>}
   */
  assetData(_url) {
    return {};
  }

  destroy() {
    this.#destroyed = true;
    for (const [key, reject] of this.#rejects) {
      reject(new GameAssetLibraryDestroyedError({
        type: this.#type,
        url: this.#assets.get(key)?.file?.url ?? key,
      }));
    }
    this.#rejects.clear();
    for (const asset of this.#assets.values()) {
      this.#unload(asset);
    }
    this.#assets.clear();
    this.#loading.clear();
    this.#queue.length = 0;
  }

  /**
   * @param {string} url
   * @param {string} key
   * @returns {Promise<void>}
   */
  #request(url, key) {
    if (this.#destroyed) {
      return Promise.reject(new GameAssetLibraryDestroyedError({
        type: this.#type,
        url,
      }));
    }
    if (this.#loading.has(key)) {
      return this.#loading.get(key);
    }
    if (this.#assets.get(key)?.loaded) {
      return Promise.resolve();
    }
    const asset = new this.#pc.Asset(key === url ? `Game ${this.#type}` : key, this.#type, { url }, this.assetData(url));
    this.#assets.set(key, asset);
    this.#registry.add(asset);
    const loading = new Promise(/**
     *
     * @param {() => void} resolve
     * @param {(error:Error)=>void} reject
     */
      (resolve, reject) => {
        this.#rejects.set(key, reject);
        asset.ready(() => {
          if (this.#destroyed) {
            this.#unload(asset);
            reject(new GameAssetLibraryDestroyedError({
              type: this.#type,
              url,
            }));

            return;
          }
          resolve();
        });
        asset.once("error", /**
       *
       * @param {Error|string} cause
       */
          (cause) => {
            this.#unload(asset);
            this.#assets.delete(key);
            reject(new GameAssetLoadError({
              type: this.#type,
              url,
              cause,
            }));
          });
      }).finally(() => {
      this.#loading.delete(key);
      this.#rejects.delete(key);
      this.#active.delete(asset);
      this.#drain();
    });
    this.#loading.set(key, loading);
    this.#queue.push(asset);
    this.#drain();

    return loading;
  }

  #drain() {
    while (!this.#destroyed && this.#active.size < 4 && this.#queue.length) {
      const asset = this.#queue.shift();
      this.#active.add(asset);
      this.#registry.load(asset);
    }
  }

  /**
   * @param {import("playcanvas").Asset} asset
   */
  #unload(asset) {
    asset.resource?.releaseImageSources?.();
    asset.unload();
    this.#registry.remove(asset);
  }
}
