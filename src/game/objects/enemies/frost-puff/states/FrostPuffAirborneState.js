import { State } from "yuka";

export class FrostPuffAirborneState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.playClip("airborne_tumble", true);
  }
}
