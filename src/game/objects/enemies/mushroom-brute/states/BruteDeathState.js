import { State } from "yuka";

/**
 * Terminal state removes physical obstruction after the death performance.
 */
export class BruteDeathState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playClip("death", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 1.6) {
      owner.destroy();
    }
  }
}
