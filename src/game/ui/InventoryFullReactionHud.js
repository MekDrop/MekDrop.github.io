import { Vec2 } from "playcanvas";
import fullInventoryEffectModelUrl from "../models/ui/full-inventory-effect.glb?url";

/**
 * @typedef {{canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: import("playcanvas").Texture}} TextureRecord
 */

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const TEXTURE_SCALE = 3;
const FULL_INDICATOR_WIDTH = 152;
const FULL_INDICATOR_HEIGHT = 120;
const FULL_INDICATOR_DURATION = 1.3;
const FULL_INDICATOR_SCALE = 0.4;

export class InventoryFullReactionHud {
  /**
   * @type {typeof import("playcanvas")|null}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application|null}
   */
  #app;
  /**
   * @type {import("./InventoryItemProjector.js").InventoryItemProjector|null}
   */
  #itemProjector;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #fullIndicator;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #fullIndicatorFx;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #fullIndicatorOutline;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #fullIndicatorModel;
  /**
   * @type {TextureRecord|null}
   */
  #fullIndicatorTexture;
  /**
   * @type {number|null}
   */
  #fullReactionElapsed = null;
  /**
   * @type {Vec2}
   */
  #fullReactionAnchor = new Vec2(0, 0);

  /**
   * Borrows the projector; owns the effect subtree and burst texture.
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, itemProjector: import("./InventoryItemProjector.js").InventoryItemProjector, parent: import("playcanvas").Entity}} options
   */
  constructor({ pc, app, itemProjector, parent }) {
    this.#pc = pc;
    this.#app = app;
    this.#itemProjector = itemProjector;
    this.#createFullIndicator(parent);
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return fullInventoryEffectModelUrl;
  }

  /**
   * @returns {boolean}
   */
  get visible() {
    return Boolean(this.#fullIndicator?.enabled);
  }

  /**
   *
   * @param {Vec2|import("playcanvas").Vec3|null} screenPosition
   */
  show(screenPosition = null) {
    if (!this.#fullIndicator) {
      return false;
    }
    this.#updateFullReactionAnchor(screenPosition);
    this.#fullReactionElapsed = 0;
    this.#fullIndicator.enabled = true;
    this.#fullIndicator.element.opacity = 1;
    this.#fullIndicatorFx.element.opacity = 1;
    this.#fullIndicatorOutline.element.opacity = 0.86;
    this.#fullIndicatorModel.element.opacity = 1;
    if (!this.#fullIndicatorModel.element.texture) {
      const modelTexture = this.#itemProjector.textureFor(
        InventoryFullReactionHud.modelUrl,
      );
      this.#fullIndicatorOutline.element.texture = modelTexture;
      this.#fullIndicatorModel.element.texture = modelTexture;
    }
    this.#fullIndicator.setLocalPosition(
      this.#fullReactionAnchor.x,
      this.#fullReactionAnchor.y,
      0,
    );
    this.#fullIndicator.setLocalEulerAngles(0, 0, 0);
    this.#fullIndicator.setLocalScale(0.01, 0.01, 1);
    this.#drawFullIndicator(0);

    return true;
  }

  /**
   *
   * @param {number} deltaTime
   * @param {Vec2|import("playcanvas").Vec3|null} screenPosition
   */
  update(deltaTime, screenPosition = null) {
    if (this.#fullReactionElapsed === null || !this.#fullIndicator) {
      return;
    }
    this.#updateFullReactionAnchor(screenPosition);
    this.#fullReactionElapsed = Math.min(
      FULL_INDICATOR_DURATION,
      this.#fullReactionElapsed + deltaTime,
    );
    const progress = this.#fullReactionElapsed / FULL_INDICATOR_DURATION;
    const entrance = Math.min(1, progress / 0.16);
    const entranceScale =
      1 + 1.7 * (entrance - 1) ** 3 + 0.7 * (entrance - 1) ** 2;
    const fade = 1 - this.#smoothstep(Math.max(0, (progress - 0.68) / 0.32));
    const wobble =
      Math.sin(progress * Math.PI * 6) * 7 * Math.max(0, 1 - progress);
    const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.06 * (1 - progress);
    const rise = this.#smoothstep(Math.max(0, (progress - 0.48) / 0.52)) * 16;
    this.#fullIndicator.setLocalPosition(
      this.#fullReactionAnchor.x,
      this.#fullReactionAnchor.y + rise,
      0,
    );
    this.#fullIndicator.setLocalEulerAngles(0, 0, wobble);
    this.#fullIndicator.setLocalScale(
      entranceScale * pulse * FULL_INDICATOR_SCALE,
      entranceScale * pulse * FULL_INDICATOR_SCALE,
      1,
    );
    this.#fullIndicator.element.opacity = fade;
    this.#fullIndicatorFx.element.opacity = fade;
    this.#fullIndicatorOutline.element.opacity = fade * 0.86;
    this.#fullIndicatorModel.element.opacity = fade;
    this.#drawFullIndicator(progress);
    if (this.#fullReactionElapsed >= FULL_INDICATOR_DURATION) {
      this.#fullReactionElapsed = null;
      this.#fullIndicator.enabled = false;
    }
  }

  destroy() {
    this.#fullIndicator?.destroy();
    this.#fullIndicatorTexture?.texture.destroy();
    this.#fullIndicator = null;
    this.#fullIndicatorFx = null;
    this.#fullIndicatorOutline = null;
    this.#fullIndicatorModel = null;
    this.#fullIndicatorTexture = null;
    this.#fullReactionElapsed = null;
    this.#itemProjector = null;
    this.#app = null;
    this.#pc = null;
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  #createFullIndicator(parent) {
    const canvas = document.createElement("canvas");
    canvas.width = FULL_INDICATOR_WIDTH * TEXTURE_SCALE;
    canvas.height = FULL_INDICATOR_HEIGHT * TEXTURE_SCALE;
    this.#fullIndicatorTexture = {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.#createTexture("Full inventory indicator texture", canvas),
    };
    this.#fullIndicator = new this.#pc.Entity("Full inventory indicator");
    this.#fullIndicator.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0.5, 0.5, 0.5, 0.5),
      pivot: new this.#pc.Vec2(0.5, 0),
      width: FULL_INDICATOR_WIDTH,
      height: FULL_INDICATOR_HEIGHT,
      useInput: false,
    });

    this.#fullIndicatorFx = new this.#pc.Entity(
      "Full inventory indicator burst",
    );
    this.#fullIndicatorFx.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: FULL_INDICATOR_WIDTH,
      height: FULL_INDICATOR_HEIGHT,
      useInput: false,
    });
    this.#fullIndicatorFx.element.texture = this.#fullIndicatorTexture.texture;
    this.#fullIndicatorFx.setLocalPosition(0, FULL_INDICATOR_HEIGHT / 2, 0);
    this.#fullIndicator.addChild(this.#fullIndicatorFx);

    this.#fullIndicatorOutline = new this.#pc.Entity(
      "Full inventory indicator outline",
    );
    this.#fullIndicatorOutline.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: 106,
      height: 106,
      color: new this.#pc.Color(0.13, 0.25, 0.45),
      opacity: 0.86,
      useInput: false,
    });
    this.#fullIndicatorOutline.setLocalPosition(0, 49, 0);
    this.#fullIndicator.addChild(this.#fullIndicatorOutline);

    this.#fullIndicatorModel = new this.#pc.Entity(
      "Full inventory indicator model",
    );
    this.#fullIndicatorModel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: 94,
      height: 94,
      color: new this.#pc.Color(0.96, 0.9, 0.68),
      useInput: false,
    });
    this.#fullIndicatorModel.setLocalPosition(0, 49, 0);
    this.#fullIndicator.addChild(this.#fullIndicatorModel);
    this.#fullIndicator.setLocalPosition(0, 0, 0);
    this.#fullIndicator.enabled = false;
    parent.addChild(this.#fullIndicator);
    this.#drawFullIndicator();
  }

  /**
   *
   * @param {number} progress
   */
  #drawFullIndicator(progress = 0) {
    const { canvas, context, texture } = this.#fullIndicatorTexture;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    context.lineJoin = "round";

    const ringProgress = this.#smoothstep(Math.min(1, progress / 0.42));
    context.globalAlpha = 0.72 * (1 - ringProgress);
    context.beginPath();
    context.arc(76, 71, 31 + ringProgress * 25, 0, Math.PI * 2);
    context.setLineDash([9, 7]);
    context.strokeStyle = "#294d7d";
    context.lineWidth = 8 - ringProgress * 3;
    context.stroke();

    context.globalAlpha = 0.92 * (1 - ringProgress);
    context.beginPath();
    context.arc(76, 71, 31 + ringProgress * 25, 0, Math.PI * 2);
    context.setLineDash([9, 7]);
    context.strokeStyle = "#f3e4ad";
    context.lineWidth = 3.5 - ringProgress * 1.5;
    context.stroke();
    context.setLineDash([]);

    const sparkProgress = this.#smoothstep(Math.min(1, progress / 0.7));
    context.globalAlpha = 0.94 * (1 - sparkProgress);
    for (const [index, angle] of [-2.45, -0.72, 0.16].entries()) {
      const distance = 33 + sparkProgress * (19 + index * 3);
      const x = 76 + Math.cos(angle) * distance;
      const y = 69 + Math.sin(angle) * distance;
      const size = 5 - sparkProgress * 2;
      context.save();
      context.translate(x, y);
      context.rotate(angle + Math.PI / 4);
      context.fillStyle = "#294d7d";
      context.fillRect(-size / 2 - 1.5, -size / 2 - 1.5, size + 3, size + 3);
      context.fillStyle = index === 1 ? "#f7e9b6" : "#78a6dc";
      context.fillRect(-size / 2, -size / 2, size, size);
      context.restore();
    }

    context.restore();
    texture.setSource(canvas);
  }

  /**
   *
   * @param {string} name
   * @param {HTMLCanvasElement} canvas
   */
  #createTexture(name, canvas) {
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
    texture.name = name;
    texture.setSource(canvas);

    return texture;
  }

  /**
   *
   * @param {Vec2|import("playcanvas").Vec3|null} screenPosition
   */
  #updateFullReactionAnchor(screenPosition) {
    if (!screenPosition) {
      return;
    }
    const canvas = this.#app.graphicsDevice.canvas;
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.sqrt(
      (bounds.width / REFERENCE_WIDTH) * (bounds.height / REFERENCE_HEIGHT),
    );
    this.#fullReactionAnchor = new Vec2(
      (screenPosition.x - canvas.clientWidth / 2) / scale,
      (canvas.clientHeight / 2 - screenPosition.y) / scale,
    );
  }

  /**
   *
   * @param {number} value
   */
  #smoothstep(value) {
    const clamped = Math.max(0, Math.min(1, value));

    return clamped * clamped * (3 - 2 * clamped);
  }
}
