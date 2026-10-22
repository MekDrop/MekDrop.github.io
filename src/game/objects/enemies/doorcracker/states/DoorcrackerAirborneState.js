import { State } from "yuka";

export class DoorcrackerAirborneState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.playClip("airborne", true);
  }
}
