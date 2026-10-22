import { MASK_SHAMAN_ANIMATION } from "./MaskShamanAnimation.js";

const LOOPING = new Set(["idle", "walk", "run", "aura_sustain", "confused_loop",
  "carried_struggle", "airborne", "stun_loop"]);

/**
 * Owns the imported rig, clip transitions and transient discipline ring.
 */
export class MaskShamanVisual {
  /**
   * @type {string|null}
   */
  #clip = null;
  /**
   * @type {import("./MaskShaman.js").MaskShaman}
   */
  #owner;

  /**
   * @param {import("./MaskShaman.js").MaskShaman} owner
   */
  constructor(owner) {
    this.#owner = owner;
    this.root = owner.modelLibrary.instantiate(owner.constructor.modelUrl);
    const wrapper = new owner.pc.Entity("Mask Shaman authored facing");
    wrapper.setLocalEulerAngles(0, 180, 0);
    wrapper.addChild(this.root);
    owner.entity.addChild(wrapper);
    this.root.addComponent("anim", { activate: true });
    const tracks = owner.modelLibrary.getAnimationTracks(owner.constructor.modelUrl,
      Object.values(MASK_SHAMAN_ANIMATION));
    for (const [name, track] of tracks) {
      this.root.anim.addAnimationState(name, track, 1, LOOPING.has(name));
    }
    this.root.anim.baseLayer.play("idle");
    this.#clip = "idle";
    this.color = new owner.pc.Color(0.12, 0.68, 1, 1);
    this.ringPoints = Array.from({ length: 49 }, /**
     *
     * @param {undefined} _
     * @param {number} i
     */
      (_, i) => new owner.pc.Vec3(
        Math.cos(i / 48 * Math.PI * 2) * owner.auraRadius, 0.055,
        Math.sin(i / 48 * Math.PI * 2) * owner.auraRadius));
    this.from = new owner.pc.Vec3();
    this.to = new owner.pc.Vec3();
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  play(name, restart = false) {
    if (this.#clip !== name || restart) {
      this.root.anim.baseLayer.transition(name, restart ? 0 : 0.12);
      this.#clip = name;
    }
  }

  /**
   * @returns {{clip: string|null, time: number, speed: number}}
   */
  get playbackStatus() {
    return {
      clip: this.#clip,
      time: this.root.anim.baseLayer.activeStateCurrentTime,
      speed: this.root.anim.speed,
    };
  }

  drawAura() {
    if (!this.#owner.auraActive) {
      return;
    }
    const position = this.#owner.position;
    for (let i = 0; i < this.ringPoints.length - 1; i++) {
      this.from.add2(position, this.ringPoints[i]);
      this.to.add2(position, this.ringPoints[i + 1]);
      this.#owner.app.drawLine(this.from, this.to, this.color, true);
    }
  }
}
