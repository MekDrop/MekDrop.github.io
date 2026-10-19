import { AbstractGameAssetLibrary } from "../assets/AbstractGameAssetLibrary.js";
import { GameAssetLoadError } from "../errors/assets/index.js";
import { audioSources } from "./audio-sources.js";

/**
 * Decoded sounds shared by every object that uses the same URL.
 */
export class GameAudioLibrary extends AbstractGameAssetLibrary {
  /**
   * @type {boolean}
   */
  #supportsOgg;
  /**
   * @type {Set<string>}
   */
  #failedOgg = new Set();
  /**
   * @type {((url:string, completed:number, total:number)=>void)|null}
   */
  #onProgress;

  /**
   * @param {Omit<ConstructorParameters<typeof AbstractGameAssetLibrary>[0], "type"> & {supportsOgg?:boolean}} options
   */
  constructor({ supportsOgg = GameAudioLibrary.oggSupported, ...options }) {
    super({
      ...options,
      type: "audio",
    });

    this.#supportsOgg = supportsOgg;
    this.#onProgress = options.onProgress ?? null;
  }

  /**
   * @returns {boolean}
   */
  static get oggSupported() {
    if (typeof document === "undefined") {
      return false;
    }
    const support = document.createElement("audio").canPlayType?.('audio/ogg; codecs="vorbis"');

    return support === "probably" || support === "maybe";
  }

  /**
   * Preserve each caller's WAV key while loading the browser's preferred format.
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
     *
     * @param {[string,string]} request
     */
      async ([key, url]) => {
        const normalized = new URL(url, import.meta.url).href;
        const formats = audioSources.find(/**
       *
       * @param {{wavUrl:string,oggUrl:string}} source
       */
          (source) => source.wavUrl === normalized);
        const preferred = this.#supportsOgg && !this.#failedOgg.has(url) ? formats?.oggUrl ?? url : url;
        let loadedUrl = preferred;
        onProgress?.(preferred, completed, requests.size);
        try {
          await super.load([{
            url: preferred,
            key,
          }], null);
        } catch (error) {
          if (preferred === url || !(error instanceof GameAssetLoadError)) {
            throw error;
          }
          // A codec claim can still fail in the download or Web Audio decoder.
          this.#failedOgg.add(url);
          loadedUrl = url;
          onProgress?.(url, completed, requests.size);
          await super.load([{
            url,
            key,
          }], null);
        }
        completed++;
        onProgress?.(loadedUrl, completed, requests.size);
      }));
  }
}
