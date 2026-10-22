import { State } from "yuka";

/**
 * Interruptions discard this countdown; a resumed approach must light a new fuse.
 */
export class DoorcrackerFuseState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.stateTime = 0;
    owner.playClip("fuse_start", true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    if (!owner.hasFuseTarget) {
      owner.interruptFuse();

      return;
    }
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= owner.fuseDuration) {
      owner.changeState("DoorcrackerDetonateState");
    } else if (owner.stateTime >= owner.clipDuration("fuse_start")) {
      owner.playClip("fuse_loop");
    }
  }
}
