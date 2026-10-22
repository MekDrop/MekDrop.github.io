import { State } from "yuka";

export class FrostPuffCarriedState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.playClip("carry_panic", true);
  }
}
