import { State } from "yuka";

export class WreckerRageState extends State {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    this.elapsed = 0;
    this.struck = new Set();
    this.destination = owner.resolveRoyalTarget();
    owner.playClip("rage_start");
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (this.elapsed < 0.5) {
      owner.stop();

      return;
    }
    owner.playClip("rage_charge_loop");
    if (this.destination?.alive === false) {
      this.destination = owner.resolveRoyalTarget();
    }
    owner.moveToward(this.destination, 3.5);
    owner.strikeContacts(this.struck, 35);
    if (this.elapsed >= 2.5) {
      owner.advanceAction(this.constructor);
    }
  }
}
