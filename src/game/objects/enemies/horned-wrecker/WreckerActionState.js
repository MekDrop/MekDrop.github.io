import { State } from "yuka";

/**
 * A timed Yuka action with a single contact window, owned by the actor.
 */
export class WreckerActionState extends State {
  /**
   * @param {string} clip
   * @param {number} duration
   * @param {number|null} contact
   */
  constructor(clip, duration, contact = null) {
    super();

    this.clip = clip;
    this.duration = duration;
    this.contact = contact;
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    this.elapsed = 0;
    this.contacted = false;
    owner.stop();
    owner.playClip(this.clip);
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (this.contact !== null && !this.contacted && this.elapsed >= this.contact) {
      this.contacted = true;
      owner.strikeContacts();
    }
    if (this.elapsed >= this.duration) {
      owner.advanceAction(this.constructor);
    }
  }
}
