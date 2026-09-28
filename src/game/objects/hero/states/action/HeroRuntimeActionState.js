import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroRuntimeActionState extends AbstractHeroActionState {
  payload = null;

  payload = null;

  #animationResolver;
  #exclusive;
  #incapacitated;
  #dying;
  #canBePatted;

  constructor(
    action,
    {
      animation = null,
      exclusive = false,
      incapacitated = false,
      dying = false,
      canBePatted = false,
    } = {},
  ) {
    super(action, typeof animation === "function" ? null : animation);
    this.#animationResolver = typeof animation === "function" ? animation : null;
    this.#exclusive = exclusive;
    this.#incapacitated = incapacitated;
    this.#dying = dying;
    this.#canBePatted = canBePatted;
  }

  get exclusive() {
    return this.#exclusive;
  }

  get incapacitated() {
    return this.#incapacitated;
  }

  get dying() {
    return this.#dying;
  }

  get canBePatted() {
    return this.#canBePatted;
  }

  enter(owner) {
    owner.enterState(this);
  }

  execute(owner) {
    owner.updateState(this);
  }

  exit(owner) {
    owner.exitState(this);
  }

  animationFor(owner) {
    return this.#animationResolver?.(owner) ?? this.animation;
  }
}
