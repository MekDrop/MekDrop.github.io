import { State } from "yuka";
import { BruteWindupState } from "./BruteWindupState.js";
import { BruteDoorBashState } from "./BruteDoorBashState.js";

/**
 * Royal pursuit; the temporary irritant never replaces the ultimate royal.
 */
export class BrutePursueState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    const target = owner.pursuitTarget;
    if (!target) {
      owner.stop();
      owner.playClip("idle");

      return;
    }
    const door = owner.findBlockingDoor(target);
    if (door && door.distance <= owner.clubRange) {
      owner.attackDoor = door.door;
      owner.faceTarget(target);
      owner.behavior.changeTo(BruteDoorBashState.name);

      return;
    }
    if (owner.distanceTo(target) <= owner.clubRange && owner.hasClearContact(target)) {
      owner.attackTarget = target;
      owner.behavior.changeTo(BruteWindupState.name);

      return;
    }
    owner.playClip(owner.enraged ? "run" : "heavy_walk");
    owner.moveToward(target, owner.enraged ? 1.5 : 0.8);
  }
}
