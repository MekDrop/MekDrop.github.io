import { State } from "yuka";

/**
 * Cinder Imp's Airborne behavior.
 */
export class CinderAirborneState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.playClip("airborne_tumble");
  }

}
