import { State } from "yuka";

export class RiftcapAirborneState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    owner.spells.collapseBubble();
    owner.playClip("airborne");
  }
}
