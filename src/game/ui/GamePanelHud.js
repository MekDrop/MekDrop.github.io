import { gameUiTheme } from "./GameUiTheme.js";

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_TEXTURE_SCALE = 4;
const COUNTER_ICON_SIZE = 22;
const COUNTER_NUMBER_WIDTH = 34;
const COUNTER_NUMBER_HEIGHT = 20;
const COUNTER_NUMBER_TEXTURE_WIDTH = 128;
const COUNTER_NUMBER_TEXTURE_HEIGHT = 64;
const COUNTER_FONT_SIZE = 48;

export class GamePanelHud {
  /**
   * @type {typeof import("playcanvas")|null}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application|null}
   */
  #app;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #entity;
  /**
   * @type {Set}
   */
  #textures = new Set();

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, name: string, priority: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {string} options.name
   * @param {number} options.priority
   */
  constructor({ pc, app, name, priority }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity(name);
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority,
    });
  }

  get pc() {
    return this.#pc;
  }

  get app() {
    return this.#app;
  }

  /**
   * @returns {number}
   */
  get counterIconSize() {
    return COUNTER_ICON_SIZE;
  }

  /**
   * @returns {number}
   */
  get counterNumberWidth() {
    return COUNTER_NUMBER_WIDTH;
  }

  /**
   * @returns {number}
   */
  get counterNumberHeight() {
    return COUNTER_NUMBER_HEIGHT;
  }

  get entity() {
    return this.#entity;
  }

  get root() {
    return this.#entity;
  }

  /**
   *
   * @param {import("playcanvas").Entity} parent
   */
  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) {
      return;
    }
    parent.addChild(this.#entity);
  }

  set visible(visible) {
    if (this.#entity) {
      this.#entity.enabled = Boolean(visible);
    }
  }

  /**
   *
   * @param {{name: string, x: number, y: number, width: number, height: number}} options
   * @param {string} options.name
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.width
   * @param {number} options.height
   */
  createPanel({ name, x, y, width, height }) {
    const panel = new this.#pc.Entity(name);
    panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width,
      height,
      useInput: false,
    });
    panel.setLocalPosition(x, -y, 0);
    this.#entity.addChild(panel);
    return panel;
  }

  /**
   *
   * @param {{parent: import("playcanvas").Entity, name: string, x: number, y: number, width: number, height: number, texture: import("playcanvas").Texture, color?: import("playcanvas").Color|string|null}} options
   * @param {import("playcanvas").Entity} options.parent
   * @param {string} options.name
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.width
   * @param {number} options.height
   * @param {import("playcanvas").Texture} options.texture
   * @param {import("playcanvas").Color|string} options.color
   */
  createImage({ parent, name, x, y, width, height, texture, color = null }) {
    const options = {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width,
      height,
      useInput: false,
    };
    if (color !== null) {
      options.color = gameUiTheme.playCanvasColor(this.#pc, color);
    }

    const entity = new this.#pc.Entity(name);
    entity.addComponent("element", options);
    entity.element.texture = texture;
    entity.setLocalPosition(x, -y, 0);
    parent.addChild(entity);
    return entity;
  }

  /**
   *
   * @param {string} name
   * @param {number} width
   * @param {number} height
   */
  createTextureRecord(name, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.createTexture(name, canvas),
    };
  }

  /**
   *
   * @param {string} name
   */
  createCounterNumberTexture(name) {
    return this.createTextureRecord(
      name,
      COUNTER_NUMBER_TEXTURE_WIDTH,
      COUNTER_NUMBER_TEXTURE_HEIGHT,
    );
  }

  /**
   *
   * @param {string} name
   * @param {number} width
   * @param {number} height
   * @param {(context: CanvasRenderingContext2D) => void} draw
   */
  createDrawnTexture(name, width, height, draw) {
    const record = this.createTextureRecord(name, width, height);
    draw(record.context);
    record.texture.setSource(record.canvas);
    return record.texture;
  }

  /**
   *
   * @param {string} name
   * @param {number} width
   * @param {number} height
   */
  createPanelTexture(name, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width * PANEL_TEXTURE_SCALE;
    canvas.height = height * PANEL_TEXTURE_SCALE;
    const context = canvas.getContext("2d");
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    this.drawPanelFrame(context, width, height);
    return this.createTexture(name, canvas);
  }

  /**
   *
   * @param {string} name
   * @param {HTMLCanvasElement} canvas
   * @param {{mipmaps?: boolean}} options
   * @param {boolean} options.mipmaps
   */
  createTexture(name, canvas, { mipmaps = false } = {}) {
    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      width: canvas.width,
      height: canvas.height,
      format: this.#pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps,
      minFilter: mipmaps
        ? this.#pc.FILTER_LINEAR_MIPMAP_LINEAR
        : this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.name = name;
    texture.setSource(canvas);
    this.#textures.add(texture);
    return texture;
  }

  /**
   *
   * @param {import("playcanvas").Texture} texture
   */
  releaseTexture(texture) {
    if (!texture || !this.#textures.delete(texture)) {
      return;
    }
    texture.destroy();
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {number} width
   * @param {number} height
   */
  drawPanelFrame(context, width, height) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, gameUiTheme.surfaceTop);
    gradient.addColorStop(1, gameUiTheme.surfaceBottom);
    this.roundedRect(
      context,
      1.5,
      1.5,
      width - 3,
      height - 3,
      gameUiTheme.borderRadius,
    );
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = gameUiTheme.shadow;
    context.lineWidth = 3;
    context.stroke();
    this.roundedRect(
      context,
      3.5,
      3.5,
      width - 7,
      height - 7,
      gameUiTheme.borderRadius,
    );
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.outline, 0.72);
    context.lineWidth = 1;
    context.stroke();
  }

  /**
   *
   * @param {{canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: import("playcanvas").Texture}} record
   * @param {number} value
   */
  drawNumber(record, value) {
    const { canvas, context, texture } = record;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = gameUiTheme.font(900, COUNTER_FONT_SIZE);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = gameUiTheme.shadow;
    context.lineWidth = 7;
    const text = String(Math.max(0, value));
    const x = canvas.width / 2;
    const y = canvas.height / 2 + 2;
    context.strokeText(text, x, y);
    context.fillStyle = gameUiTheme.text;
    context.fillText(text, x, y);
    texture.setSource(canvas);
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   */
  roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  syncDrawOrder() {
    this.#entity?.screen?.syncDrawOrder();
  }

  destroy() {
    this.#entity?.destroy();
    for (const texture of this.#textures) {
      texture.destroy();
    }
    this.#textures.clear();
    this.#entity = null;
    this.#app = null;
    this.#pc = null;
  }
}
