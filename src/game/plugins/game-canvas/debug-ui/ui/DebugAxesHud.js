import { gameUiTheme } from "../../../../ui/GameUiTheme.js";

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_WIDTH = 214;
const PANEL_HEIGHT = 134;
const TEXTURE_SCALE = 2;
const AXIS_ORIGIN = Object.freeze({ x: 66, y: 68 });
const GROUND_AXIS_LENGTH = 40;
const VERTICAL_AXIS_LENGTH = 45;
const WIND_ORIGIN = Object.freeze({ x: 168, y: 88 });
const WIND_ARROW_LENGTH = 23;
const DEFAULT_DIRECTIONS = Object.freeze({
  x: { x: 0.88, y: -0.47 },
  y: { x: 0.88, y: 0.47 },
  z: { x: 0, y: -1 },
});
const DEFAULT_WIND = Object.freeze({
  direction: { x: 0.78, y: 0, z: 0.48 },
  speed: 0,
});

export class DebugAxesHud {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {HTMLCanvasElement}
   */
  #gameCanvas;
  /**
   *
   * @type {pc.Entity}
   */
  #entity;
  /**
   *
   * @type {pc.Texture}
   */
  #texture;
  /**
   *
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {pc.EventHandle}
   */
  #updateHandle;
  /**
   *
   * @type {string}
   */
  #signature = "";

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, gameCanvas: HTMLCanvasElement}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {HTMLCanvasElement} options.gameCanvas
   */
  constructor({ pc, app, gameCanvas }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {HTMLCanvasElement}
     */
    this.#gameCanvas = gameCanvas;
    /**
     *
     * @type {pc.Entity}
     */
    this.#entity = new pc.Entity("Debug axes HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 104,
    });

    /**
     *
     * @type {HTMLCanvasElement}
     */
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = PANEL_WIDTH * TEXTURE_SCALE;
    this.#canvas.height = PANEL_HEIGHT * TEXTURE_SCALE;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = this.#canvas.getContext("2d");
    this.#context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    /**
     *
     * @type {pc.Texture}
     */
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Debug axes HUD texture",
      width: this.#canvas.width,
      height: this.#canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });

    const panel = new pc.Entity("Debug axes panel");
    panel.addComponent("element", {
      type: pc.ELEMENTTYPE_IMAGE,
      anchor: new pc.Vec4(0, 0, 0, 0),
      pivot: new pc.Vec2(0, 0),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      color: new pc.Color(1, 1, 1),
      useInput: false,
    });
    panel.element.texture = this.#texture;
    panel.setLocalPosition(gameUiTheme.spaceMd, gameUiTheme.spaceMd, 0);
    this.#entity.addChild(panel);
    this.#entity.screen.syncDrawOrder();
    this.#entity.enabled = false;
    /**
     *
     * @type {pc.EventHandle}
     */
    this.#updateHandle = app.on("update", this.#update);
    this.#draw(DEFAULT_DIRECTIONS, DEFAULT_WIND, 1);
  }

  /**
   *
   * @param {pc.Entity} parent
   */
  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) {
      return;
    }
    parent.addChild(this.#entity);
  }

  /**
   *
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (!this.#entity?.screen) {
      return;
    }
    this.#entity.screen.referenceResolution = new this.#pc.Vec2(
      Math.max(1, width),
      Math.max(1, height),
    );
  }

  set visible(visible) {
    if (!this.#entity) {
      return;
    }
    const nextVisible = Boolean(visible);
    const beginsUpdate = nextVisible && !this.#entity.enabled;
    this.#entity.enabled = nextVisible;
    if (!beginsUpdate) {
      return;
    }
    this.#sync(true);
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#texture?.destroy();
    this.#entity = null;
    this.#texture = null;
    this.#canvas = null;
    this.#context = null;
    this.#gameCanvas = null;
    this.#app = null;
    this.#pc = null;
  }

  /**
   * Keep the compass in sync with the camera each frame.
   * @type {() => void}
   */
  #update = () => {
    if (!this.#entity?.enabled) {
      return;
    }
    this.#sync();
  };

  /**
   *
   * @param {boolean} force
   */
  #sync(force = false) {
    const directions = this.#gameCanvas?.debugDirections ?? DEFAULT_DIRECTIONS;
    const wind = this.#gameCanvas?.wind ?? DEFAULT_WIND;
    const zoom = this.#gameCanvas?.zoom ?? 1;
    const values = [
      directions.x.x,
      directions.x.y,
      directions.y.x,
      directions.y.y,
      directions.z.x,
      directions.z.y,
      wind.direction.x,
      wind.direction.y,
      wind.direction.z,
      wind.speed,
      zoom,
    ];
    const signature = values.map(/**
     *
     * @param {number} value
     */
    (value) => value.toFixed(3)).join(":");
    if (!force && signature === this.#signature) {
      return;
    }
    this.#signature = signature;
    this.#draw(directions, wind, zoom);
  }

  /**
   *
   * @param {string[]} directions
   * @param {{speed: number, direction?: pc.Vec3}} wind
   * @param {number} zoom
   */
  #draw(directions, wind, zoom) {
    const context = this.#context;
    context.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    context.beginPath();
    context.roundRect(
      0.5,
      0.5,
      PANEL_WIDTH - 1,
      PANEL_HEIGHT - 1,
      gameUiTheme.borderRadius,
    );
    context.fillStyle = gameUiTheme.withAlpha(
      gameUiTheme.surfaceBottom,
      0.84,
    );
    context.fill();
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.outline, 0.34);
    context.lineWidth = 1;
    context.stroke();

    const windDirection = this.#projectWind(directions, wind.direction);
    context.beginPath();
    context.setLineDash([2, 4]);
    context.arc(WIND_ORIGIN.x, WIND_ORIGIN.y, 27, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 209, 102, 0.035)";
    context.fill();
    context.strokeStyle = "rgba(255, 226, 154, 0.34)";
    context.lineWidth = 1.5;
    context.stroke();
    context.setLineDash([]);
    this.#drawArrow(
      WIND_ORIGIN,
      {
        x: WIND_ORIGIN.x + windDirection.x * WIND_ARROW_LENGTH,
        y: WIND_ORIGIN.y + windDirection.y * WIND_ARROW_LENGTH,
      },
      "#ffd166",
    );
    context.beginPath();
    context.arc(WIND_ORIGIN.x, WIND_ORIGIN.y, 3, 0, Math.PI * 2);
    context.fillStyle = "#fff3ca";
    context.fill();
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.shadow, 0.88);
    context.lineWidth = 1.5;
    context.stroke();

    this.#drawAxis(directions.x, GROUND_AXIS_LENGTH, "X", "#ff6b6b");
    this.#drawAxis(directions.y, GROUND_AXIS_LENGTH, "Y", "#7dff88");
    this.#drawAxis(directions.z, VERTICAL_AXIS_LENGTH, "Z", "#7cc8ff");

    context.beginPath();
    context.moveTo(132, 28);
    context.lineTo(132, 104);
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.outline, 0.28);
    context.lineWidth = 1;
    context.stroke();

    this.#drawText("WIND", 167, 26, {
      color: "#ffe29a",
      font: gameUiTheme.font(700, 9),
    });
    this.#drawText(`${wind.speed.toFixed(2)} u/s`, 167, 40, {
      color: "#fff3ca",
      font: gameUiTheme.font(700, 8),
    });
    this.#drawText(`ZOOM ${zoom.toFixed(2)}x`, 167, 122, {
      color: gameUiTheme.info,
      font: gameUiTheme.font(700, 9),
    });
    this.#texture.setSource(this.#canvas);
  }

  /**
   *
   * @param {string[]} directions
   * @param {{speed: number, direction?: pc.Vec3}} wind
   */
  #projectWind(directions, wind) {
    const x =
      wind.x * directions.x.x +
      wind.z * directions.y.x +
      wind.y * directions.z.x;
    const y =
      wind.x * directions.x.y +
      wind.z * directions.y.y +
      wind.y * directions.z.y;
    const length = Math.max(0.001, Math.hypot(x, y));
    return { x: x / length, y: y / length };
  }

  /**
   *
   * @param {string} direction
   * @param {number} length
   * @param {string} label
   * @param {string} color
   */
  #drawAxis(direction, length, label, color) {
    const end = {
      x: AXIS_ORIGIN.x + direction.x * length,
      y: AXIS_ORIGIN.y + direction.y * length,
    };
    this.#drawArrow(AXIS_ORIGIN, end, color);
    const labelX = Math.max(
      15,
      Math.min(117, AXIS_ORIGIN.x + direction.x * (length + 8)),
    );
    const labelY = Math.max(
      16,
      Math.min(
        118,
        AXIS_ORIGIN.y +
          direction.y * (length + 8) +
          (direction.y > 0 ? 5 : 0),
      ),
    );
    this.#drawText(label, labelX, labelY, {
      color,
      font: gameUiTheme.font(700, 14),
    });
  }

  /**
   *
   * @param {pc.Vec3|pc.Vec3} start
   * @param {pc.Vec3|pc.Vec3} end
   * @param {string} color
   */
  #drawArrow(start, end, color) {
    const context = this.#context;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.stroke();

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 9;
    const arrowWidth = 5;
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(
      end.x - Math.cos(angle) * arrowLength + Math.sin(angle) * arrowWidth,
      end.y - Math.sin(angle) * arrowLength - Math.cos(angle) * arrowWidth,
    );
    context.lineTo(
      end.x - Math.cos(angle) * arrowLength - Math.sin(angle) * arrowWidth,
      end.y - Math.sin(angle) * arrowLength + Math.cos(angle) * arrowWidth,
    );
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  /**
   *
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {{color: string, font: string}} options
   * @param {string} options.color
   * @param {string} options.font
   */
  #drawText(text, x, y, { color, font }) {
    const context = this.#context;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = font;
    context.lineJoin = "round";
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.shadow, 0.9);
    context.lineWidth = 3;
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
  }
}
