import { State } from "yuka";

/**
 * Saved-map clip inspection only; normal spell selection never enters here.
 */
export class RiftcapClipTestState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    owner.spells.collapseBubble();
    owner.stop();
  }
}
