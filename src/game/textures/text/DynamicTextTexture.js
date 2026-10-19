/**
 * Mutable canvas lettering with one GPU texture for its entire lifetime.
 */
export class DynamicTextTexture {
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {import("playcanvas").Texture|null}
   */
  #texture;
  /**
   * @type {(canvas:HTMLCanvasElement, text:string)=>void}
   */
  #paint;
  /**
   * @type {string}
   */
  #text;
  /**
   * @type {number}
   */
  #width;

  /**
   * @param {{pc:typeof import("playcanvas"), device:import("playcanvas").GraphicsDevice, width:number, height:number, text:string, name:string, paint:(canvas:HTMLCanvasElement,text:string)=>void, srgb?:boolean}} options
   */
  constructor({ pc, device, width, height, text, name, paint, srgb = false }) {
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#width = width;
    this.#paint = paint;
    this.#texture = new pc.Texture(device, {
      name,
      width,
      height,
      format: pc.PIXELFORMAT_RGBA8,
      srgb,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      anisotropy: 4,
    });
    this.text = text;
  }

  get texture() {
    return this.#texture;
  }

  get text() {
    return this.#text;
  }

  /**
   * @param {string} value
   */
  set text(value) {
    if (value === this.#text) {
      return;
    }
    this.#text = value;
    // Reset pixels and canvas state exactly as a fresh canvas would.
    this.#canvas.width = this.#width;
    this.#paint(this.#canvas, value);
    this.#texture.setSource(this.#canvas);
  }

  destroy() {
    this.#texture?.destroy();
    this.#texture = null;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {string} text
   * @returns {DynamicTextTexture}
   */
  static inscription(pc, device, text) {
    return new DynamicTextTexture({
      pc,
      device,
      width: 512,
      height: 160,
      text,
      name: `${text} sign lettering`,
      paint: DynamicTextTexture.#paintInscription,
      srgb: true,
    });
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {string} text
   * @returns {DynamicTextTexture}
   */
  static gatewayLabel(pc, device, text) {
    return new DynamicTextTexture({
      pc,
      device,
      width: 128,
      height: 128,
      text,
      name: `Gateway banner sign ${text}`,
      paint: DynamicTextTexture.#paintGatewayLabel,
    });
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} text
   */
  static #paintInscription(canvas, text) {
    const context = canvas.getContext("2d");
    const words = text.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
    const lines = words.length > 2
      ? [words.slice(0, -1).join(" "), words.at(-1)]
      : [words.join(" ")];
    let fontSize = lines.length > 1 ? 90 : 160;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    do {
      context.font = `bold ${fontSize}px "Palatino Linotype", Georgia, serif`;
      /**
       *
       * @param {string} line
       */
      const fitsSignLine = (line) => {
        const metrics = context.measureText(line);
        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

        return metrics.width <= 494 && height <= (lines.length > 1 ? 67 : 142);
      };
      if (lines.every(fitsSignLine)) {
        break;
      }
      fontSize -= 2;
    } while (fontSize > 24);
    context.fillStyle = "#efd8a2";
    for (const [index, line] of lines.entries()) {
      const metrics = context.measureText(line);
      let x = (canvas.width - metrics.width) / 2;
      const baseline = 80 + (index - (lines.length - 1) / 2) * 76
        + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      context.textAlign = "left";
      for (const [letterIndex, letter] of [...line].entries()) {
        const variation = Math.sin(letterIndex * 2.3 + index);
        context.save();
        context.translate(x, baseline + variation * 1.5);
        context.rotate(variation * 0.025);
        context.fillText(letter, 0, 0);
        context.restore();
        x += context.measureText(letter).width;
      }
    }
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} symbol
   */
  static #paintGatewayLabel(canvas, symbol) {
    const size = 128;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      "700 82px 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif";
    context.lineJoin = "round";
    context.lineWidth = 7;
    context.strokeStyle = "rgba(28, 50, 65, 0.45)";
    context.strokeText(symbol, size / 2, size / 2 + 3);
    context.fillStyle = "#eaf8ff";
    context.fillText(symbol, size / 2, size / 2 + 3);
  }
}
