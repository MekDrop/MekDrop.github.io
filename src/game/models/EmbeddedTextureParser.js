/**
 * Retries embedded raster images through the browser image decoder.
 */
export class EmbeddedTextureParser {
  /**
   * @type {import("playcanvas").TextureHandler["imgParser"]}
   */
  #parser;

  /**
   * @param {import("playcanvas").TextureHandler["imgParser"]} parser PlayCanvas's installed image parser.
   */
  constructor(parser) {
    this.#parser = parser;
  }

  /**
   * @param {import("playcanvas").Application} app
   */
  static install(app) {
    const handler = app.loader.getHandler("texture");
    handler.addParser(new EmbeddedTextureParser(handler.imgParser));
  }

  /**
   * @param {{ext: string, asset: import("playcanvas").Asset}} context
   */
  canParse({ ext, asset }) {
    return !!asset?.file?.contents && ["png", "jpg", "jpeg", "webp"].includes(ext);
  }

  /**
   * @param {{load: string, original: string}} url
   * @param {(error: Error|null, image?: ImageBitmap|HTMLImageElement) => void} callback
   * @param {import("playcanvas").Asset} asset
   */
  load(url, callback, asset) {
    this.#parser.load(url, /**
     *
     * @param {Error|null} error
     * @param {ImageBitmap|HTMLImageElement} image
     */
      (error, image) => {
        if (error?.name !== "InvalidStateError") {
          callback(error, image);

          return;
        }
        this.#loadImage(asset.file.contents, error, callback);
      }, asset);
  }

  /**
   * @param {string} url
   * @param {ImageBitmap|HTMLImageElement} data
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {Record<string, unknown>} options
   */
  open(url, data, device, options) {
    return this.#parser.open(url, data, device, options);
  }

  /**
   * @param {ArrayBuffer} contents
   * @param {Error} originalError
   * @param {(error: Error|null, image?: ImageBitmap|HTMLImageElement) => void} callback
   */
  #loadImage(contents, originalError, callback) {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([contents]));
    /**
     * @param {Error|null} error
     */
    const finish = (error) => {
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      callback(error, error ? undefined : image);
    };
    image.onload = () => finish(null);
    image.onerror = () => finish(originalError);
    image.src = url;
  }
}
