import { State } from "yuka";

export class GobblerInspectState extends State {
  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    owner.stop();
  }
}
