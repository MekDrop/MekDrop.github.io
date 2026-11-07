import { HERO_MOOD } from "../enum/HeroMood.js";
import { HeroMoodHud } from "./HeroMoodHud.js";

/**
 * Shows affection or growing annoyance through the shared native mood HUD.
 */
export class LatchMoodHud extends HeroMoodHud {
  /**
   * @param {import("../objects/enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {string} kind Affection (happy) or annoyance (agitated).
   */
  constructor(owner, kind = HERO_MOOD.HAPPY) {
    super({
      pc: owner.pc,
      app: owner.app,
      getMood: () => LatchMoodHud.#getMood(owner, kind),
    });

    this.entity.name = kind === HERO_MOOD.HAPPY ? "Slime affection HUD" : "Slime annoyance HUD";
    this.attach();
  }

  /**
   * @param {import("../objects/enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {string} kind
   * @returns {import("./HeroMoodHud.js").HeroMoodSnapshot|null}
   */
  static #getMood(owner, kind) {
    const affection = owner.affection;
    const annoyance = owner.annoyance?.level ?? 0;
    const hasAffection = owner.statuses.has("affection") || affection.happyRemaining > 0 || affection.charge > 0;
    const isAffection = kind === HERO_MOOD.HAPPY;
    if (!owner.alive || owner.gatewayArrival.active || (isAffection ? !hasAffection : annoyance <= 0)) {
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
    if (hasAffection && annoyance > 0) {
      point.x += isAffection ? -30 : 30;
    }

    return {
      kind: isAffection ? HERO_MOOD.HAPPY : owner.annoyance.active ? HERO_MOOD.ANGRY : HERO_MOOD.AGITATED,
      reactionProgress: Math.min(1, Math.max(0, isAffection ? affection.charge / 3 : annoyance / 5)),
      screen: point,
    };
  }
}
