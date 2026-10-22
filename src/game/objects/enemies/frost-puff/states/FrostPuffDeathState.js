import { State } from "yuka";

export class FrostPuffDeathState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    this.time = 0;
    owner.stop();
    owner.clearShots();
    owner.playClip("death", true);
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    this.time += owner.deltaTime;
    if (this.time >= 1.1) {
      owner.destroy();
    }
  }
}
