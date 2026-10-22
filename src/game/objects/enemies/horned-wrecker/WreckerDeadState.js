import { State } from "yuka";

export class WreckerDeadState extends State {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.stop();
    owner.playClip("death");
    owner.contactActors.clear();
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 2.4) {
      owner.destroy();
    }
  }
}
