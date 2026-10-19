import { AbstractGameAssetLibrary } from "../assets/AbstractGameAssetLibrary.js";
import { sharedTextures } from "./shared-textures.js";

/**
 * Shared standalone textures and external images referenced by imported models.
 */
export class GameTextureLibrary extends AbstractGameAssetLibrary {
  /**
   * @param {Omit<ConstructorParameters<typeof AbstractGameAssetLibrary>[0], "type">} options
   */
  constructor(options) {
    super({
      ...options,
      type: "texture",
    });
  }

  /**
   * @param {string} url
   * @returns {Record<string, boolean>}
   */
  assetData(url) {
    return sharedTextures.find(/**
     *
     * @param {{url:string, imageName:string, assetData:Record<string,boolean>}} Texture
     */
      (Texture) => Texture.url === url)?.assetData ?? {};
  }

  /**
   * Preserve named samplers, except canonical shared images which reuse one asset.
   * @param {Record<string,string>} urls
   * @param {((url:string, completed:number, total:number)=>void)|null} onProgress
   */
  loadNamed(urls, onProgress = null) {
    const requests = Object.entries(urls).map(/**
     *
     * @param {[string,string]} entry
     */
      ([key, url]) => ({
        key: GameTextureLibrary.#shared(url) ? url : key,
        url,
      }));

    return this.load(requests, onProgress);
  }

  /**
   * Named references to shared images borrow the model texture itself.
   * @param {string} url
   * @param {string} key
   * @returns {import("playcanvas").Asset}
   */
  get(url, key = url) {
    return super.get(url, GameTextureLibrary.#shared(url) ? url : key);
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  static #shared(url) {
    return sharedTextures.some(/**
     * @param {{url:string}} texture
     */
      (texture) => texture.url === url);
  }

  /**
   * @type {(image:{name?:string}, callback:(error:Error|null, asset?:import("playcanvas").Asset)=>void)=>void}
   * @param {{name?:string}} image
   * @param {(error:Error|null, asset?:import("playcanvas").Asset)=>void} callback
   */
  processImage = (image, callback) => {
    const Texture = sharedTextures.find(/**
     *
     * @param {{url:string, imageName:string, assetData:Record<string,boolean>}} Texture
     */
      (Texture) => Texture.imageName === image.name);
    if (!Texture) {
      callback(null);

      return;
    }
    this.load([Texture.url]).then(() => callback(null, this.get(Texture.url)), /**
     *
     * @param {Error} error
     */
      (error) => callback(error));
  };

  /**
   * Keep library-owned textures alive when an individual container is unloaded.
   * @param {import("playcanvas").Asset} model
   */
  detachModel(model) {
    const textures = model.resource?.textures;
    if (textures) {
      for (let index = textures.length - 1; index >= 0; index--) {
        if (this.owns(textures[index])) {
          textures.splice(index, 1);
        }
      }
    }
  }
}
