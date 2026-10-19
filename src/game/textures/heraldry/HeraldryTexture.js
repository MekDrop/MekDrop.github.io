/**
 * @typedef {{background:string, field:string, highlight:string, shadow:string, emblem:string}} HeraldryPalette
 */

/**
 * Repaintable flag and banner artwork, independent of cloth geometry and physics.
 */
export class HeraldryTexture {
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {import("playcanvas").Texture|null}
   */
  #texture;
  /**
   * @type {HeraldryPalette}
   */
  #palette;
  /**
   * @type {(canvas:HTMLCanvasElement, palette:HeraldryPalette)=>void}
   */
  #paint;

  /**
   * @param {{pc:typeof import("playcanvas"), device:import("playcanvas").GraphicsDevice, width:number, height:number, name:string, palette:HeraldryPalette, paint:(canvas:HTMLCanvasElement,palette:HeraldryPalette)=>void}} options
   */
  constructor({ pc, device, width, height, name, palette, paint }) {
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#paint = paint;
    this.#texture = new pc.Texture(device, {
      name,
      width,
      height,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      anisotropy: 4,
      mipmaps: true,
    });
    this.palette = palette;
  }

  get texture() {
    return this.#texture;
  }

  /**
   * @returns {HeraldryPalette}
   */
  get palette() {
    return { ...this.#palette };
  }

  /**
   * @param {Partial<HeraldryPalette>} value
   */
  set palette(value) {
    this.#palette = {
      ...this.#palette,
      ...value,
    };
    this.#paint(this.#canvas, this.#palette);
    this.#texture.setSource(this.#canvas);
  }

  destroy() {
    this.#texture?.destroy();
    this.#texture = null;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {Partial<HeraldryPalette>} palette
   * @returns {HeraldryTexture}
   */
  static flag(pc, device, palette = {}) {
    return new HeraldryTexture({
      pc,
      device,
      width: 64,
      height: 40,
      name: "Tapered flag",
      palette: {
        background: "#153c84",
        field: "#245bb7",
        highlight: "#3470d2",
        shadow: "#0f2c66",
        emblem: "#f1dfad",
        ...palette,
      },
      paint: HeraldryTexture.#paintFlag,
    });
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {Partial<HeraldryPalette>} palette
   * @returns {HeraldryTexture}
   */
  static banner(pc, device, palette = {}) {
    return new HeraldryTexture({
      pc,
      device,
      width: 64,
      height: 96,
      name: "Castle banner cloth",
      palette: {
        background: "#173f88",
        field: "#245bb7",
        highlight: "#3470d2",
        shadow: "#0f2d69",
        emblem: "#f1dfad",
        ...palette,
      },
      paint: HeraldryTexture.#paintBanner,
    });
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HeraldryPalette} palette
   */
  static #paintFlag(canvas, palette) {
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = palette.field;
    context.fillRect(4, 3, canvas.width - 8, canvas.height - 6);
    context.fillStyle = palette.highlight;
    context.fillRect(8, 3, 5, canvas.height - 6);
    context.fillStyle = palette.shadow;
    context.fillRect(49, 3, 7, canvas.height - 6);

    context.fillStyle = palette.emblem;
    context.fillRect(23, 13, 15, 13);
    context.fillRect(20, 10, 6, 7);
    context.fillRect(28, 8, 6, 9);
    context.fillRect(36, 10, 6, 7);
    context.fillStyle = palette.field;
    context.fillRect(28, 18, 6, 8);
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HeraldryPalette} palette
   */
  static #paintBanner(canvas, palette) {
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;

    context.fillStyle = palette.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = palette.field;
    context.fillRect(7, 0, canvas.width - 14, canvas.height);
    context.fillStyle = palette.highlight;
    context.fillRect(10, 0, 6, canvas.height);
    context.fillStyle = palette.shadow;
    context.fillRect(canvas.width - 15, 0, 6, canvas.height);

    context.fillStyle = palette.emblem;
    context.fillRect(21, 31, 22, 24);
    context.fillRect(18, 27, 8, 10);
    context.fillRect(28, 24, 8, 13);
    context.fillRect(38, 27, 8, 10);
    context.fillRect(18, 49, 28, 7);
    context.fillRect(27, 54, 10, 10);
    context.fillStyle = palette.field;
    context.fillRect(27, 43, 10, 12);
  }
}
