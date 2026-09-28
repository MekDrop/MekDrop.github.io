import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroRuntimeActionState extends AbstractHeroActionState {
  /**
   *
    * @type {(input: import("src/game/objects/ObjectTypes.js").HeroActionContext) => string|number}
   */
  payload = null;

  /**
   *
    * @type {boolean}
   */
  #animationResolver;
  /**
   *
    * @type {boolean}
   */
  #exclusive;
  /**
   *
    * @type {boolean}
   */
  #incapacitated;
  /**
   *
    * @type {boolean}
   */
  #dying;
  /**
   *
    * @type {boolean}
   */
  #canBePatted;
  /**
   *
    * @type {boolean}
   */
  #allowedTransitions;
  /**
   *
    * @type {boolean}
   */
  #allowsJump;
  /**
   *
    * @type {number}
   */
  #requiresGrounded;
  /**
   *
    * @type {boolean}
   */
  #blocksMovement;
  /**
   *
    * @type {(input: import("src/game/objects/ObjectTypes.js").HeroActionContext) => import("src/game/objects/ObjectTypes.js").Point3}
   */
  #movementResolver;
  /**
   *
    * @type {(input: import("src/game/objects/ObjectTypes.js").HeroActionContext) => number}
   */
  #facingResolver;
  /**
   *
    * @type {boolean}
   */
  #locksFacing;
  /**
   *
    * @type {boolean}
   */
  #snapFacingResolver;
  /**
   *
    * @type {boolean}
   */
  #allowsFootPlacement;
  /**
   *
    * @type {boolean}
   */
  #allowsIdleHeadLook;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #locksHeadForward;
  /**
   *
    * @type {number}
   */
  #controlsHeadPresentation;

  /**
   *
   * @param {string} action
   * @param {{animation: ConstructorParameters<typeof AbstractHeroActionState>[0], exclusive: boolean, incapacitated: boolean, dying: ConstructorParameters<typeof AbstractHeroActionState>[0], canBePatted: boolean, allowedTransitions: boolean, allowsJump: boolean, requiresGrounded: number, blocksMovement: boolean, movement: ConstructorParameters<typeof AbstractHeroActionState>[0], facing: {x: number, y: number, z: number}, locksFacing: boolean, snapFacing: ConstructorParameters<typeof AbstractHeroActionState>[0], allowsFootPlacement: boolean, allowsIdleHeadLook: boolean, locksHeadForward: {x: number, y: number, z: number}, controlsHeadPresentation: number}} options
   * @param {ConstructorParameters<typeof AbstractHeroActionState>[0]} options.animation
   * @param {boolean} options.exclusive
   * @param {boolean} options.incapacitated
   * @param {ConstructorParameters<typeof AbstractHeroActionState>[0]} options.dying
   * @param {boolean} options.canBePatted
   * @param {boolean} options.allowedTransitions
   * @param {boolean} options.allowsJump
   * @param {number} options.requiresGrounded
   * @param {boolean} options.blocksMovement
   * @param {ConstructorParameters<typeof AbstractHeroActionState>[0]} options.movement
   * @param {{x: number, y: number, z: number}} options.facing
   * @param {boolean} options.locksFacing
   * @param {ConstructorParameters<typeof AbstractHeroActionState>[0]} options.snapFacing
   * @param {boolean} options.allowsFootPlacement
   * @param {boolean} options.allowsIdleHeadLook
   * @param {{x: number, y: number, z: number}} options.locksHeadForward
   * @param {number} options.controlsHeadPresentation
   */
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

  /**
   *
   * @param {string} action
   */
  allowsTransitionTo(action) {
    return this.#allowedTransitions.has(action);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   * @param {import("src/game/objects/ObjectTypes.js").Point3} desired
   * @param {{x: number, y: number, z: number}} velocity
   */
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

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   * @param {import("src/game/objects/ObjectTypes.js").Point3} fallback
   */
  facingFor(owner, fallback) {
    return this.#facingResolver?.({
      owner,
      payload: this.payload,
      fallback,
    }) ?? fallback;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  snapsFacing(owner) {
    return this.#snapFacingResolver({ owner, payload: this.payload });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    owner.enterState(this);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    owner.updateState(this);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    owner.exitState(this);
  }

  present() {}

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  animationFor(owner) {
    return this.#animationResolver?.(owner) ?? this.animation;
  }
}
