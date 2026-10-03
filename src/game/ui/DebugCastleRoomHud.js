import { GamePanelHud } from "./GamePanelHud.js";
import { gameUiTheme } from "./GameUiTheme.js";

const WIDTH = 360;
const HEIGHT = 36;

export class DebugCastleRoomHud extends GamePanelHud {
  /**
   * @type {ReturnType<GamePanelHud["createTextureRecord"]>}
   */
  #record;
  /**
   * @type {string|null}
   */
  #message = null;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application}} options
   */
  constructor(options) {
    super({ ...options, name: "Debug castle room HUD", priority: 106 });
    this.#record = this.createTextureRecord("Debug castle room", WIDTH * 3, HEIGHT * 3);
    this.#record.context.scale(3, 3);
    const panel = this.createPanel({ name: "Current castle room", x: 0, y: 56, width: WIDTH, height: HEIGHT });
    panel.element.anchor = new this.pc.Vec4(0.5, 1, 0.5, 1);
    panel.setLocalPosition(-WIDTH / 2, -56, 0);
    this.createImage({ parent: panel, name: "Castle room message", x: 0, y: 0, width: WIDTH, height: HEIGHT, texture: this.#record.texture });
    this.syncDrawOrder();
    this.visible = false;
  }

  /**
   * @param {string} message
   */
  set message(message) {
    if (message === this.#message) {
      return;
    }
    this.#message = message;
    const { context, canvas, texture } = this.#record;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawPanelFrame(context, WIDTH, HEIGHT);
    context.font = gameUiTheme.font(700, 13);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = gameUiTheme.text;
    context.fillText(message, WIDTH / 2, HEIGHT / 2, WIDTH - 24);
    texture.setSource(canvas);
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.entity.screen.referenceResolution = new this.pc.Vec2(Math.max(1, width), Math.max(1, height));
  }
}
