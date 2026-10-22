import { State } from "yuka";

export class RiftcapDeathState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.spells.destroy();
    owner.playClip("death");
    owner.stop();
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 2) {
      owner.destroy();
    }
  }
}
