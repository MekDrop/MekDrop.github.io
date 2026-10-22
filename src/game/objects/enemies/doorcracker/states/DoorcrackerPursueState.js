import { State } from "yuka";

export class DoorcrackerPursueState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.playClip("walk_loaded");
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip("idle_loaded");

      return;
    }
    const door = owner.findObstructingDoor(royal);
    if (door && owner.distanceTo(door) <= owner.braceDistance) {
      owner.bracedDoor = door;
      owner.changeState("DoorcrackerBraceState");

      return;
    }
    if (owner.distanceTo(royal) <= owner.contactDistance) {
      owner.bracedDoor = null;
      owner.changeState("DoorcrackerBraceState");

      return;
    }
    owner.playClip(owner.encouraged ? "run_loaded" : "walk_loaded");
    owner.moveToward(owner.entranceWaypoint ?? royal, owner.encouraged ? 1.65 : 1.05);
  }
}
