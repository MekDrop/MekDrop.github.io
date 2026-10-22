import { State } from "yuka";

export class GobblerAirborneState extends State {
  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  enter(owner) {
    owner.requestClip("airborne");
  }
}
