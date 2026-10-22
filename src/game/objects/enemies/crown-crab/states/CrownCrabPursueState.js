import { State } from "yuka";

export class CrownCrabPursueState extends State {
  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    const target = crab.pursuitTarget;
    if (!target || crab.reachedRoyals.has(target)) {
      crab.stop();
      crab.requestAnimation("idle");

      return;
    }
    const rival = crab.findRival();
    if (rival) {
      crab.startClaw(rival);

      return;
    }
    const blocker = crab.findQueueBlocker(target);
    if (blocker) {
      crab.demandQueuePosition(blocker);

      return;
    }
    const waypoint = crab.navigation?.next(target) ?? target;
    const door = crab.findEntranceObstruction(waypoint);
    if (door) {
      crab.startClaw(door);

      return;
    }
    if (crab.distanceTo(target) <= 1.15 && crab.hasClearContact(target)) {
      crab.startClaw(target);

      return;
    }
    const revenge = crab.revengeTarget && !crab.grudgesSuppressed;
    crab.requestAnimation(revenge ? "revenge_run" : "scuttle_forward");
    crab.moveToward(waypoint, revenge ? 1.2 : 0.6, 0.01);
  }
}
