import { State } from "yuka";

/**
 * Royal pursuit; towers never become navigation goals.
 */
export class FusePursuitState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.playClip("hop_locomotion_loop");
  }

  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip("idle_bounce");

      return;
    }
    if (owner.distanceTo(royal) < 0.85 || owner.closedDoorAhead(royal)) {
      owner.ignite();
      owner.stop();

      return;
    }
    owner.playClip("hop_locomotion_loop");
    owner.moveToward(royal, 3.2);
    if (owner.grounded && owner.elapsed >= owner.nextHopAt) {
      owner.entity.rigidbody.applyImpulse(0, 2.4, 0);
      owner.grounded = false;
      owner.nextHopAt = owner.elapsed + 0.42;
    }
  }
}
