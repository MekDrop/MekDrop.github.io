import { HeroPatHand } from "../../characters/hero/HeroPatHand.js";
import { LatchAffectionHud } from "../../../ui/LatchAffectionHud.js";

/**
 * Reuses the production patting hand; the slug owns its presentation and lifecycle.
 */
export class LatchPatPresentation {
  /**
   * @type {boolean}
   */
  destroyed = false;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.hand = new HeroPatHand({
      pc: owner.pc,
      modelLibrary: owner.modelLibrary,
      getPatPosition: ()=>owner.position.clone().add(new owner.pc.Vec3(0, .72, 0)),
      getViewRotation: ()=>(owner.runtime.camera.entity.getEulerAngles().y - 45) / 90,
      onContact: ()=>owner.affection.contact(),
    });
    this.hand.entity.name = "Slime patting hand";
    owner.app.root.addChild(this.hand.entity);
    this.hud = new LatchAffectionHud(owner);
    this.updateHandle = owner.app.on("update", this.update, this);
    this.renderHandle = owner.app.on("prerender", this.render, this);
  }
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return HeroPatHand.modelUrl;
  }
  /**
   * @returns {boolean}
   */
  pat() {
    if (this.destroyed || !this.owner.affection.canPat || this.hand.entity.enabled) {
      return false;
    }
    if (!this.hand.pat()) {
      return false;
    }
    this.owner.affection.beginPat();

    return true;
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.destroyed) {
      return;
    }
    if (!this.owner.affection.available) {
      this.hand.entity.enabled = false;
    }
    this.hand.update(dt);
  }
  render() {
    if (this.destroyed) {
      return;
    }
    this.hud.update();
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    // An update already being dispatched can still contain this callback.
    this.destroyed = true;
    this.updateHandle.off();
    this.renderHandle.off();
    this.hand.destroy();
    this.hud.destroy();
  }
}
