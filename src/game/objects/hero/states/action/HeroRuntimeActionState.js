import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroRuntimeActionState extends AbstractHeroActionState {
  payload = null;

  #animationResolver;
  #exclusive;
  #incapacitated;
  #dying;
  #canBePatted;
  #allowedTransitions;
  #allowsJump;
  #requiresGrounded;
  #blocksMovement;
  #movementResolver;
  #facingResolver;
  #locksFacing;
  #snapFacingResolver;
  #allowsFootPlacement;
  #allowsIdleHeadLook;
  #locksHeadForward;
  #controlsHeadPresentation;

  constructor(
    action,
    {
      animation = null,
      exclusive = false,
      incapacitated = false,
      dying = false,
      canBePatted = false,
      allowedTransitions = [],
      allowsJump = false,
      requiresGrounded = false,
      blocksMovement = false,
      movement = null,
      facing = null,
      locksFacing = false,
      snapFacing = false,
      allowsFootPlacement = true,
      allowsIdleHeadLook = true,
      locksHeadForward = false,
      controlsHeadPresentation = false,
    } = {},
  ) {
    super(action, typeof animation === "function" ? null : animation);
    this.#animationResolver = typeof animation === "function" ? animation : null;
    this.#exclusive = exclusive;
    this.#incapacitated = incapacitated;
    this.#dying = dying;
    this.#canBePatted = canBePatted;
    this.#allowedTransitions = new Set(allowedTransitions);
    this.#allowsJump = allowsJump;
    this.#requiresGrounded = requiresGrounded;
    this.#blocksMovement = blocksMovement;
    this.#movementResolver = movement;
    this.#facingResolver = facing;
    this.#locksFacing = locksFacing;
    this.#snapFacingResolver = typeof snapFacing === "function"
      ? snapFacing
      : () => snapFacing;
    this.#allowsFootPlacement = allowsFootPlacement;
    this.#allowsIdleHeadLook = allowsIdleHeadLook;
    this.#locksHeadForward = locksHeadForward;
    this.#controlsHeadPresentation = controlsHeadPresentation;
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

  get allowsJump() {
    return this.#allowsJump;
  }

  get requiresGrounded() {
    return this.#requiresGrounded;
  }

  get locksFacing() {
    return this.#locksFacing;
  }

  get allowsFootPlacement() {
    return this.#allowsFootPlacement;
  }

  get allowsIdleHeadLook() {
    return this.#allowsIdleHeadLook;
  }

  get locksHeadForward() {
    return this.#locksHeadForward;
  }

  get controlsHeadPresentation() {
    return this.#controlsHeadPresentation;
  }

  allowsTransitionTo(action) {
    return this.#allowedTransitions.has(action);
  }

  movementFor(owner, desired, velocity) {
    if (this.#movementResolver) {
      return this.#movementResolver({
        owner,
        payload: this.payload,
        desired,
        velocity,
      });
    }
    return this.#blocksMovement ? { x: 0, z: 0 } : desired;
  }

  facingFor(owner, fallback) {
    return this.#facingResolver?.({
      owner,
      payload: this.payload,
      fallback,
    }) ?? fallback;
  }

  snapsFacing(owner) {
    return this.#snapFacingResolver({ owner, payload: this.payload });
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

  present() {}

  animationFor(owner) {
    return this.#animationResolver?.(owner) ?? this.animation;
  }
}
