import { HERO_MOOD } from "../enum/HeroMood.js";
import { HeroMoodHud } from "./HeroMoodHud.js";

/**
 * Uses the hero's mood presentation for the slug's affection feedback.
 */
export class LatchAffectionHud extends HeroMoodHud {
  /**
   * @param {import("../objects/enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    super({
      pc: owner.pc,
      app: owner.app,
      getMood: () => LatchAffectionHud.#getMood(owner),
    });

    this.entity.name = "Slime mood HUD";
    this.attach();
  }

  /**
   * @param {import("../objects/enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {import("./HeroMoodHud.js").HeroMoodSnapshot|null}
   */
  static #getMood(owner) {
    const affection = owner.affection;
    if (!owner.alive || owner.gatewayArrival.active || (!owner.statuses.has("affection") &&
      affection.happyRemaining <= 0 && affection.charge <= 0)) {
      return null;
    }
    const canvas = owner.app.graphicsDevice.canvas;
    const camera = owner.runtime.camera;
    const position = owner.position.clone().add(new owner.pc.Vec3(0, 1.15, 0));
    const point = camera.component.worldToScreen(position);
    if (position.clone().sub(camera.entity.getPosition()).dot(camera.entity.forward) <= 0 ||
      point.x < 0 || point.x > canvas.clientWidth || point.y < 0 || point.y > canvas.clientHeight) {
      return null;
    }

    return {
      kind: HERO_MOOD.HAPPY,
      reactionProgress: Math.min(1, Math.max(0, affection.charge / 3)),
      screen: point,
    };
  }
}
