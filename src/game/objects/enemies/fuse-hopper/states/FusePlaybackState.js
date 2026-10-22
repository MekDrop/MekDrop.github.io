import { State } from "yuka";
/**
 * Production playback inspection selected through saved map HUD controls.
 */
export class FusePlaybackState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    owner.stop();
  }
}
