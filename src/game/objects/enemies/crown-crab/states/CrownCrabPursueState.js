import { State } from "yuka";

export class CrownCrabPursueState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    const target = crab.pursuitTarget;
    if (!target) {
      crab.stop();
      crab.requestAnimation("idle");

      return;
    }
    const rival = crab.findRival();
    if (rival) {
      crab.startClaw(rival);

      return;
    }
    const door = crab.findEntranceObstruction(target);
    if (door) {
      crab.startClaw(door);

      return;
    }
    if (crab.distanceTo(target) <= 1.15) {
      crab.startClaw(target);

      return;
    }
    const revenge = crab.revengeTarget && !crab.grudgesSuppressed;
    crab.requestAnimation(revenge ? "revenge_run" : "scuttle_forward");
    crab.moveToward(target, revenge ? 2.2 : 1.2);
  }
}
