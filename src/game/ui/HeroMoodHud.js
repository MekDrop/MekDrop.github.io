import { GamePanelHud } from "./GamePanelHud.js";
import { HERO_MOOD } from "../enum/HeroMood.js";

/**
 * @typedef {{kind: string, reactionProgress?: number, screen?: {x: number, y: number, radius: number}|null}} HeroMoodSnapshot
 */

export class HeroMoodHud extends GamePanelHud {
  /**
   * @type {() => HeroMoodSnapshot|null}
   */
  #getMood;
  /**
   * @type {import("playcanvas").Entity}
   */
  #icon;
  /**
   * @type {Map<string, import("playcanvas").Texture>}
   */
  #icons = new Map();
  /**
   * @type {MediaQueryList|null}
   */
  #motionPreference;
  /**
   * @type {string|null}
   */
  #kind = null;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {number}
   */
  #growth = 1;
  /**
   * @type {number|null}
   */
  #leaveElapsed = null;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, getMood: () => HeroMoodSnapshot|null}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {() => HeroMoodSnapshot|null} options.getMood
   */
  constructor({ pc, app, getMood }) {
    super({ pc, app, name: "Hero mood HUD", priority: 106 });
    this.#getMood = getMood;
    this.#motionPreference = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    for (const [kind, symbol, color] of [
      [HERO_MOOD.HAPPY, "♥", "#98edaf"],
      [HERO_MOOD.AGITATED, "!", "#ffd27b"],
      [HERO_MOOD.ANGRY, "💢", "#ff958b"],
    ]) {
      this.#icons.set(kind, this.createDrawnTexture(`Hero mood ${kind}`, 192, 160,
        /**
         * @param {CanvasRenderingContext2D} context
         */
        (context) => {
          context.scale(4, 4);
          context.font = "900 25px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillStyle = color;
          context.shadowColor = "#000";
          context.shadowBlur = 3;
          context.shadowOffsetY = 2;
          context.fillText(symbol, 24, 34);
        }));
    }
    this.#icon = new pc.Entity("Hero mood icon");
    this.#icon.addComponent("element", {
      type: pc.ELEMENTTYPE_IMAGE,
      anchor: new pc.Vec4(0, 1, 0, 1),
      pivot: new pc.Vec2(0.5, 0),
      width: 48,
      height: 40,
      useInput: false,
    });
    this.entity.addChild(this.#icon);
    this.#icon.enabled = false;
    this.syncDrawOrder();
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const mood = this.#getMood();
    const kind = mood?.kind;
    const visible = Boolean(mood?.screen && this.#icons.has(kind));
    this.#icon.enabled = visible;
    if (!visible) {
      this.#kind = null;
      this.#leaveElapsed = null;
      return;
    }
    const reduced = this.#motionPreference?.matches;
    const dt = Math.max(0, Number(deltaTime) || 0);
    if (kind !== this.#kind) {
      if (this.#kind && !reduced && this.#leaveElapsed === null) {
        this.#leaveElapsed = 0;
      }
      if (this.#leaveElapsed !== null) {
        this.#leaveElapsed += dt;
      }
      if (reduced || !this.#kind || this.#leaveElapsed >= 0.12) {
        this.#kind = kind;
        this.#icon.element.texture = this.#icons.get(kind);
        this.#elapsed = 0;
        this.#leaveElapsed = null;
      }
    } else {
      this.#leaveElapsed = null;
    }
    this.#elapsed += dt;
    const targetGrowth = 1 + (mood.reactionProgress ?? 0) * 0.9;
    this.#growth = reduced ? targetGrowth : this.#growth + (targetGrowth - this.#growth) * (1 - Math.exp(-dt / 0.16));
    const wave = reduced ? 0 : (1 - Math.cos(Math.PI * this.#elapsed / (this.#kind === HERO_MOOD.ANGRY ? 0.18 : 0.9))) / 2;
    const pop = reduced ? 1 : this.#elapsed < 0.182
      ? 0.25 + 0.97 * this.#elapsed / 0.182
      : this.#elapsed < 0.28 ? 1.22 - 0.22 * (this.#elapsed - 0.182) / 0.098 : 1;
    const leave = this.#leaveElapsed === null ? 0 : Math.min(1, this.#leaveElapsed / 0.12);
    const scale = this.#growth * pop * (1 + wave * (this.#kind === HERO_MOOD.ANGRY ? 0.15 : 0.12)) * (1 - leave * 0.7);
    const canvas = this.app.graphicsDevice.canvas;
    const cssScale = this.entity.screen.scale * canvas.clientWidth / canvas.width;
    // The projection already includes the world-space height. Compensate for the
    // six transparent pixels below the glyph rather than adding a head radius.
    this.#icon.setLocalPosition(mood.screen.x / cssScale,
      -(mood.screen.y + 6 * scale - wave * (this.#kind === HERO_MOOD.ANGRY ? 0 : 8) - leave * 10) / cssScale, 0);
    // Size the UI element in screen pixels; entity transforms must not resize it.
    this.#icon.element.width = 48 * scale / cssScale;
    this.#icon.element.height = 40 * scale / cssScale;
    this.#icon.setLocalScale(1, 1, 1);
    this.#icon.setLocalEulerAngles(0, 0, reduced ? 0 : -wave * (this.#kind === HERO_MOOD.ANGRY ? 12 : 0) - leave * 12);
    this.#icon.element.opacity = (reduced ? 1 : Math.min(1, this.#elapsed / 0.182)) * (1 - leave);
  }
}
