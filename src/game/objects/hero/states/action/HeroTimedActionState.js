import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroTimedActionState extends HeroRuntimeActionState {
  /**
   *
    * @type {number}
   */
  #duration;

  /**
   *
   * @param {string} action
   * @param {number} duration
   * @param {ConstructorParameters<typeof HeroRuntimeActionState>[0]} options
   */
  constructor(action, duration, options) {
    super(action, options);
    this.#duration = duration;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    this.payload.elapsed = Math.min(
      this.#duration,
      this.payload.elapsed + owner.deltaTime,
    );
    if (this.payload.elapsed >= this.#duration) {
      owner.finish();
      owner.feedback.actionComplete?.(this.action);
    }
  }
}
