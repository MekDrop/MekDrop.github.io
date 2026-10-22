import { State } from "yuka";

/**
 * Death releases discipline immediately and removes the actor after its clip.
 */
export class ShamanDeadState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.aura.active = false;
    owner.requestClip("death");
    owner.stop();
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= 1.2) {
      owner.destroy();
    }
  }
}
