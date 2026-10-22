import { State } from "yuka";

export class WreckerPursueState extends State {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    owner.playClip("heavy_walk");
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip("idle_snort");

      return;
    }
    const route = owner.entranceRoute(royal);
    if (route.door && owner.distanceTo(route.door) < 1.5) {
      owner.batterDoor = route.door;
      owner.beginBattering();

      return;
    }
    owner.moveToward(route.waypoint ?? royal, 0.9);
    if (owner.contactActors.size > 0) {
      owner.provoke();
    }
  }
}
