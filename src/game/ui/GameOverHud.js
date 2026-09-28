import { gameUiTheme } from "./GameUiTheme.js";

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 122;

export class GameOverHud {
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
   * @type {import("playcanvas").Texture|null}
   */
  #panelTexture;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, translate: (key: string) => string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {(key: string) => string} options.translate
   */
  constructor({ pc, app, translate }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Game over HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 110,
    });
    this.#createDimmer();
    this.#panelTexture = this.#createPanelTexture(
      translate("game.game_over"),
      translate("game.restart_prompt"),
    );
    this.#createPanel();
    this.#entity.enabled = false;
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
    if (this.#entity) this.#entity.enabled = Boolean(visible);
  }

  destroy() {
    this.#entity?.destroy();
    this.#panelTexture?.destroy();
    this.#entity = null;
    this.#panelTexture = null;
    this.#app = null;
    this.#pc = null;
  }

  #createDimmer() {
    const dimmer = new this.#pc.Entity("Game over dimmer");
    dimmer.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 0, 1, 1),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      margin: new this.#pc.Vec4(0, 0, 0, 0),
      color: gameUiTheme.playCanvasColor(this.#pc, gameUiTheme.backdrop),
      opacity: 0.62,
      useInput: false,
    });
    this.#entity.addChild(dimmer);
  }

  #createPanel() {
    const panel = new this.#pc.Entity("Game over panel");
    panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.#pc.Vec2(0.5, 0),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      color: new this.#pc.Color(1, 1, 1),
      useInput: false,
    });
    panel.element.texture = this.#panelTexture;
    panel.setLocalPosition(
      0,
      gameUiTheme.spaceLg + gameUiTheme.spaceSm + gameUiTheme.spaceXs,
      0,
    );
    this.#entity.addChild(panel);
    this.#entity.screen.syncDrawOrder();
  }

  /**
   *
   * @param {string} title
   * @param {string} prompt
   */
  #createPanelTexture(title, prompt) {
    const canvas = document.createElement("canvas");
    canvas.width = 680;
    canvas.height = 244;
    const context = canvas.getContext("2d");
    const x = 18;
    const y = 18;
    const width = canvas.width - 36;
    const height = canvas.height - 36;

    context.shadowColor = gameUiTheme.withAlpha(gameUiTheme.shadow, 0.52);
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    this.#roundedRect(
      context,
      x,
      y,
      width,
      height,
      gameUiTheme.borderRadius,
    );
    context.fillStyle = gameUiTheme.withAlpha(gameUiTheme.surfaceBottom, 0.96);
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = gameUiTheme.negative;
    context.lineWidth = 3;
    context.stroke();

    const titleGradient = context.createLinearGradient(0, 52, 0, 140);
    titleGradient.addColorStop(0, gameUiTheme.negativeBright);
    titleGradient.addColorStop(1, gameUiTheme.negative);
    context.font = gameUiTheme.font(900, 64);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = gameUiTheme.negativeDark;
    context.lineWidth = 10;
    context.strokeText(String(title).toUpperCase(), canvas.width / 2, 94);
    context.fillStyle = titleGradient;
    context.fillText(String(title).toUpperCase(), canvas.width / 2, 94);

    context.font = gameUiTheme.font(800, 22);
    context.strokeStyle = gameUiTheme.shadow;
    context.lineWidth = 6;
    context.strokeText(String(prompt).toUpperCase(), canvas.width / 2, 169);
    context.fillStyle = gameUiTheme.text;
    context.fillText(String(prompt).toUpperCase(), canvas.width / 2, 169);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      width: canvas.width,
      height: canvas.height,
      format: this.#pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps: false,
      minFilter: this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.name = "Game over panel texture";
    texture.setSource(canvas);
    return texture;
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
  #roundedRect(context, x, y, width, height, radius) {
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
}
