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
    if (owner.combat.reachedRoyals.has(royal)) {
      owner.stop();
      owner.playClip("idle_snort");

      return;
    }
    const route = owner.entranceRoute(royal);
    const blockingDoor = owner.blockingDoor(royal);
    const obstruction = blockingDoor ?? route.door;
    if (obstruction && owner.distanceTo(obstruction) < 1.8) {
      owner.batterDoor = obstruction;
      owner.beginBattering();

      return;
    }
    // The full-size capsule cannot plan through a narrow closed doorway.
    // Approach its reachable leaf first, then let the timed fist contact break it.
    if (blockingDoor) {
      owner.moveToward(blockingDoor, 0.9, 1.5);

      return;
    }
    if (owner.combat.canReach(royal) && !owner.combat.reachedRoyals.has(royal)) {
      owner.behavior.changeTo("WreckerFistWindupState");

      return;
    }
    const waypoint = owner.navigation.next(royal) ?? route.waypoint ?? { position: owner.targetPosition(royal) };
    owner.moveToward(waypoint, 0.9, 0.01);
    owner.navigation.stepToward(waypoint);
    if (owner.contactActors.size > 0) {
      owner.provoke();
    }
  }
}
