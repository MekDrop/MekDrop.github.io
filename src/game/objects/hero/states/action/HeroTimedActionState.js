import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroTimedActionState extends HeroRuntimeActionState {
  #duration;

  constructor(action, duration, options) {
    super(action, options);
    this.#duration = duration;
  }

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
