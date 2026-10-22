import { State } from "yuka";

/**
 * Saved test-map clip inspection; gameplay actions may still interrupt it.
 */
export class DivecapInspectState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    owner.stop();
  }
}
