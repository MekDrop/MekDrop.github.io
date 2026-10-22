import { WreckerActionState } from "./WreckerActionState.js";

export class WreckerBatterState extends WreckerActionState {
  constructor() {
    super("door_batter", 1.2, 0.6);
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    const point = owner.targetPosition(owner.batterDoor);
    if (point) {
      const direction = point.clone().sub(owner.position);
      owner.entity.setEulerAngles(0, Math.atan2(-direction.x, -direction.z) * 180 / Math.PI, 0);
    }
    super.enter(owner);
  }
}
