import { State } from "yuka";

export class DoorcrackerCarriedState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("carried_ready", true);
  }
}
