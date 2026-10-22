import { State } from "yuka";

export class DivecapLandingState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseStarted = owner.elapsed;
    owner.playClip("impact", true);
    owner.splashImpact();
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    const age = owner.elapsed - owner.phaseStarted;
    if (age >= 1 / 3) {
      owner.playClip(owner.lastImpactHits > 0 ? "land_recover" : "missed_land_stun");
    }
    if (age >= 1 / 3 + (owner.lastImpactHits > 0 ? 2 / 3 : 1.2)) {
      owner.changeState(owner.statuses.has("stun") || owner.statuses.has("confused") ? "DivecapStunState" : "DivecapPursueState");
    }
  }
}
