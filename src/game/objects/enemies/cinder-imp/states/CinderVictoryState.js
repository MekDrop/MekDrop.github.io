import { State } from "yuka";

/**
 * The actual royal's game-over performance owns defeat after contact.
 */
export class CinderVictoryState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("victory");
  }
}
