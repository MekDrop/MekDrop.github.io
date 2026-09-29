import { StateMachine } from "yuka";
import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "../../states/action/HeroRuntimeActionState.js";
import { HeroDrowningActionState } from "../../states/action/HeroDrowningActionState.js";
import { HeroBridgeClimbActionState } from "../../states/action/HeroBridgeClimbActionState.js";
import { HeroBurningActionState } from "../../states/action/HeroBurningActionState.js";
import { HeroRespawningActionState } from "../../states/action/HeroRespawningActionState.js";
import { HeroToolActionState } from "../../states/action/HeroToolActionState.js";
import {
  HeroCollectingActionState,
  HeroInventoryFullActionState,
} from "../../states/action/HeroCollectionActionState.js";
import { HeroDodgeActionState } from "../../states/action/HeroDodgeActionState.js";
import { HeroPatReactionActionState } from "../../states/action/HeroPatReactionActionState.js";
import { HeroFallingToDeathActionState } from "../../states/action/HeroFallingToDeathActionState.js";
import { HeroGameOverActionState } from "../../states/action/HeroGameOverActionState.js";
import { HeroRepelledActionState } from "../../states/action/HeroRepelledActionState.js";
import { HeroBlockedDigReactionActionState } from "../../states/action/HeroBlockedDigReactionActionState.js";
import {
  HeroEdgeRefusalActionState,
  HeroHoleRefusalActionState,
} from "../../states/action/HeroRefusalActionState.js";

const USER_ACTIONS = [
  HERO_ACTION.DODGING,
  HERO_ACTION.USING_TOOL,
  HERO_ACTION.COLLECTING,
  HERO_ACTION.INVENTORY_FULL_REACTION,
  HERO_ACTION.BLOCKED_DIG_REACTION,
];

export class HeroActionBehavior {
  /**
   *
    * @type {string}
   */
  #stateMachine;
  /**
   *
    * @type {number}
   */
  #context;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  #pendingPayload = null;
  /**
   *
    * @type {number}
   */
  #deltaTime = 0;
  /**
   *
    * @type {{enter?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void, update?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior, deltaTime: number) => void, exit?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void}|null}
   */
  #handler = null;
  /**
   *
    * @type {string|number}
   */
  #restingAction = HERO_ACTION.EXPLORING;
  /**
   *
    * @type {Map}
   */
  #statesByAction = new Map();

  /**
   *
   * @param {{bridgeClimbEnd: import("src/game/objects/ObjectTypes.js").Point3, dodgeAnimationDuration: number, edgeRefusalDuration: number, holeRefusalDuration: number, blockedDigReactionDuration: boolean, repelDuration: number, repelSpeed: number, feedback: import("src/game/objects/ObjectTypes.js").HeroActionFeedback, handler: {enter?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void, update?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior, deltaTime: number) => void, exit?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void}|null}} options
   * @param {import("src/game/objects/ObjectTypes.js").Point3} options.bridgeClimbEnd
   * @param {number} options.dodgeAnimationDuration
   * @param {number} options.edgeRefusalDuration
   * @param {number} options.holeRefusalDuration
   * @param {boolean} options.blockedDigReactionDuration
   * @param {number} options.repelDuration
   * @param {number} options.repelSpeed
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionFeedback} options.feedback
   * @param {{enter?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void, update?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior, deltaTime: number) => void, exit?: (state: HeroRuntimeActionState, behavior: HeroActionBehavior) => void}|null} options.handler
   */
  constructor({
    bridgeClimbEnd,
    dodgeAnimationDuration,
    edgeRefusalDuration,
    holeRefusalDuration,
    blockedDigReactionDuration,
    repelDuration,
    repelSpeed,
    feedback,
    handler = null,
  }) {

    this.#handler = handler;

    this.#context = {
      get payload() {
        return this.behavior.payload;
      },
      behavior: this,
      bridgeClimbEnd,
      dodgeAnimationDuration,
      edgeRefusalDuration,
      holeRefusalDuration,
      blockedDigReactionDuration,
      repelDuration,
      repelSpeed,
      feedback,
      get deltaTime() {
        return this.behavior.deltaTime;
      },
      /**
       *
       * @param {string} action
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} payload
       */
      transition: (action, payload) => this.#transition(action, payload),
      finish: () => this.finish(),
      /**
       *
       * @param {string} state
       */
      enterState: (state) => {
        state.payload = this.#pendingPayload;

        this.#pendingPayload = null;
        this.#handler?.enter?.(state, this);
      },
      /**
       *
       * @param {string} state
       */
      updateState: (state) => this.#handler?.update?.(
        state,
        this,
        this.#deltaTime,
      ),
      /**
       *
       * @param {string} state
       */
      exitState: (state) => {
        this.#handler?.exit?.(state, this);
        state.payload = null;
      },
    };

    this.#stateMachine = new StateMachine(this.#context);
    for (const state of this.#states) {
      this.#stateMachine.add(state.action, state);
      this.#statesByAction.set(state.action, state);
    }
    this.#stateMachine.changeTo(HERO_ACTION.EXPLORING);
  }

  /**
   *
    * @returns {Array<HeroRuntimeActionState>}
   */
  get #states() {
    /**
     *
     * @param {string} action
     * @param {ConstructorParameters<typeof HeroRuntimeActionState>[1]} options
     */
    const state = (action, options) => new HeroRuntimeActionState(action, options);
    return [
      state(HERO_ACTION.EXPLORING, {
        canBePatted: true,
        allowedTransitions: USER_ACTIONS,
        allowsJump: true,
      }),
      state(HERO_ACTION.BOOSTING_COUNTRY_FINANCES, {
        animation: HERO_ANIMATION.IDLE,
        canBePatted: true,
        allowedTransitions: USER_ACTIONS,
        allowsJump: true,
      }),
      new HeroToolActionState(),
      new HeroCollectingActionState(),
      new HeroInventoryFullActionState(),
      new HeroDodgeActionState(),
      new HeroRepelledActionState(this.#context.repelDuration),
      new HeroEdgeRefusalActionState(this.#context.edgeRefusalDuration),
      new HeroHoleRefusalActionState(this.#context.holeRefusalDuration),
      new HeroBlockedDigReactionActionState(
        this.#context.blockedDigReactionDuration,
      ),
      new HeroPatReactionActionState(USER_ACTIONS),
      state(HERO_ACTION.ANGRY_ESCAPE, { canBePatted: true }),
      new HeroDrowningActionState(),
      new HeroBridgeClimbActionState(),
      new HeroFallingToDeathActionState(),
      new HeroBurningActionState(),
      new HeroRespawningActionState(),
      new HeroGameOverActionState(),
    ];
  }

  /**
   *
    * @returns {{name: string, action: string, animation: string|number, animationSpeed: number, incapacitated: boolean, dying: boolean, canBePatted: boolean, boostingCountryFinances: boolean}}
   */
  get state() {
    const current = this.#stateMachine.currentState;
    return {
      name: current.action,
      action: current.action,
      animation: this.animation,
      animationSpeed: this.animationSpeed,
      incapacitated: current.incapacitated,
      dying: current.dying,
      canBePatted: current.canBePatted,
      boostingCountryFinances: this.boostingCountryFinances,
    };
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get payload() {
    return this.#stateMachine.currentState.payload;
  }

  get deltaTime() {
    return this.#deltaTime;
  }

  /**
   *
    * @returns {number}
   */
  get animation() {
    return this.#stateMachine.currentState.animationFor(this.#context);
  }

  /**
   *
    * @returns {number}
   */
  get animationSpeed() {
    if (this.collectAction?.positioning || this.inventoryFullAction?.positioning) {
      return this.payload.positioning.animationSpeed ?? 1;
    }
    if (this.dodgeAction) {
      return this.#context.dodgeAnimationDuration / this.dodgeAction.duration;
    }
    return 1;
  }

  /**
   *
    * @returns {boolean}
   */
  get exclusive() {
    return this.#stateMachine.currentState.exclusive;
  }

  /**
   *
    * @returns {boolean}
   */
  get incapacitated() {
    return this.#stateMachine.currentState.incapacitated;
  }

  /**
   *
    * @returns {boolean}
   */
  get dying() {
    return this.#stateMachine.currentState.dying;
  }

  /**
   *
    * @returns {boolean}
   */
  get canBePatted() {
    return this.#stateMachine.currentState.canBePatted;
  }

  /**
   *
    * @returns {boolean}
   */
  get canJump() {
    return this.#stateMachine.currentState.allowsJump;
  }

  /**
   *
    * @returns {boolean}
   */
  get locksFacing() {
    return this.#stateMachine.currentState.locksFacing;
  }

  /**
   *
    * @returns {boolean}
   */
  get snapsFacing() {
    return this.#stateMachine.currentState.snapsFacing(this.#context);
  }

  /**
   *
    * @returns {boolean}
   */
  get allowsFootPlacement() {
    return this.#stateMachine.currentState.allowsFootPlacement;
  }

  /**
   *
    * @returns {boolean}
   */
  get allowsIdleHeadLook() {
    return this.#stateMachine.currentState.allowsIdleHeadLook;
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get locksHeadForward() {
    return this.#stateMachine.currentState.locksHeadForward;
  }

  /**
   *
    * @returns {number}
   */
  get controlsHeadPresentation() {
    return this.#stateMachine.currentState.controlsHeadPresentation;
  }

  /**
   *
   * @param {string} action
   * @param {{grounded: boolean}} options
   * @param {boolean} options.grounded
   */
  canStart(action, { grounded = false } = {}) {
    const target = this.#statesByAction.get(action);
    if (!target || (target.requiresGrounded && !grounded)) {
      return false;
    }
    return this.#stateMachine.currentState.allowsTransitionTo(action);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").Point3} desired
   * @param {{x: number, y: number, z: number}} velocity
   */
  movementFor(desired, velocity) {
    return this.#stateMachine.currentState.movementFor(
      this.#context,
      desired,
      velocity,
    );
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").Point3} fallback
   */
  facingFor(fallback) {
    return this.#stateMachine.currentState.facingFor(this.#context, fallback);
  }

  /**
   *
   * @param {number} deltaTime
   */
  present(deltaTime) {
    this.#deltaTime = deltaTime;
    this.#stateMachine.currentState.present(this.#context);
  }

  /**
   *
    * @returns {boolean}
   */
  get boostingCountryFinances() {
    return this.#restingAction === HERO_ACTION.BOOSTING_COUNTRY_FINANCES;
  }

  set boostingCountryFinances(value) {
    this.#restingAction = value
      ? HERO_ACTION.BOOSTING_COUNTRY_FINANCES
      : HERO_ACTION.EXPLORING;
    if (this.#isResting) {
      this.#transition(this.#restingAction, null);
    }
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get toolAction() {
    return this.#payloadFor(HERO_ACTION.USING_TOOL);
  }

  set toolAction(action) {
    this.#setAction(HERO_ACTION.USING_TOOL, action);
  }

  /**
   *
    * @returns {number}
   */
  get collectAction() {
    return this.#payloadFor(HERO_ACTION.COLLECTING);
  }

  set collectAction(action) {
    this.#setAction(HERO_ACTION.COLLECTING, action);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get inventoryFullAction() {
    return this.#payloadFor(HERO_ACTION.INVENTORY_FULL_REACTION);
  }

  set inventoryFullAction(action) {
    this.#setAction(HERO_ACTION.INVENTORY_FULL_REACTION, action);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get dodgeAction() {
    return this.#payloadFor(HERO_ACTION.DODGING);
  }

  set dodgeAction(action) {
    this.#setAction(HERO_ACTION.DODGING, action);
  }

  /**
   *
    * @returns {number}
   */
  get repelAction() {
    return this.#payloadFor(HERO_ACTION.REPELLED);
  }

  set repelAction(action) {
    this.#setAction(HERO_ACTION.REPELLED, action);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get edgeRefusalAction() {
    return this.#payloadFor(HERO_ACTION.EDGE_REFUSAL);
  }

  set edgeRefusalAction(action) {
    this.#setAction(HERO_ACTION.EDGE_REFUSAL, action);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get holeRefusalAction() {
    return this.#payloadFor(HERO_ACTION.HOLE_REFUSAL);
  }

  set holeRefusalAction(action) {
    this.#setAction(HERO_ACTION.HOLE_REFUSAL, action);
  }

  /**
   *
    * @returns {boolean}
   */
  get blockedDigReactionAction() {
    return this.#payloadFor(HERO_ACTION.BLOCKED_DIG_REACTION);
  }

  set blockedDigReactionAction(action) {
    this.#setAction(HERO_ACTION.BLOCKED_DIG_REACTION, action);
  }

  /**
   *
    * @returns {number}
   */
  get patReactionRemaining() {
    return this.#payloadFor(HERO_ACTION.PAT_REACTION)?.remaining ?? 0;
  }

  set patReactionRemaining(remaining) {
    this.#setAction(
      HERO_ACTION.PAT_REACTION,
      remaining > 0 ? { remaining } : null,
    );
  }

  /**
   *
    * @returns {boolean}
   */
  get angryEscape() {
    return this.#stateMachine.in(HERO_ACTION.ANGRY_ESCAPE);
  }

  set angryEscape(active) {
    this.#setAction(HERO_ACTION.ANGRY_ESCAPE, active ? {} : null);
  }

  /**
   *
    * @returns {boolean}
   */
  get drowning() {
    return this.#stateMachine.in(HERO_ACTION.DROWNING);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get drowningAction() {
    return this.#payloadFor(HERO_ACTION.DROWNING);
  }

  set drowningAction(action) {
    this.#setAction(HERO_ACTION.DROWNING, action);
  }

  /**
   *
    * @returns {boolean}
   */
  get bridgeClimbing() {
    return this.#stateMachine.in(HERO_ACTION.BRIDGE_CLIMB);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get bridgeClimbAction() {
    return this.#payloadFor(HERO_ACTION.BRIDGE_CLIMB);
  }

  set bridgeClimbAction(action) {
    this.#setAction(HERO_ACTION.BRIDGE_CLIMB, action);
  }

  /**
   *
    * @returns {boolean}
   */
  get fallingToDeath() {
    return this.#stateMachine.in(HERO_ACTION.FALLING_TO_DEATH);
  }

  set fallingToDeath(falling) {
    this.#setAction(HERO_ACTION.FALLING_TO_DEATH, falling ? {} : null);
  }

  /**
   *
    * @returns {boolean}
   */
  get burning() {
    return this.#stateMachine.in(HERO_ACTION.BURNING);
  }

  /**
   * @returns {boolean}
   */
  get ashes() {
    return this.payload?.ashes === true;
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  get lavaDeathAction() {
    return this.#payloadFor(HERO_ACTION.BURNING);
  }

  set lavaDeathAction(action) {
    this.#setAction(HERO_ACTION.BURNING, action);
  }

  /**
   *
    * @returns {number}
   */
  get respawning() {
    return this.#stateMachine.in(HERO_ACTION.RESPAWNING);
  }

  /**
   *
    * @returns {number}
   */
  get respawnAction() {
    return this.#payloadFor(HERO_ACTION.RESPAWNING);
  }

  set respawnAction(action) {
    this.#setAction(HERO_ACTION.RESPAWNING, action);
  }

  /**
   *
    * @returns {number}
   */
  get gameOver() {
    return this.#stateMachine.in(HERO_ACTION.GAME_OVER);
  }

  endGame() {
    this.#transition(HERO_ACTION.GAME_OVER, null);
  }

  tryBeginDrowning() {
    return this.#statesByAction.get(HERO_ACTION.DROWNING).tryEnter(this.#context);
  }

  finish() {
    this.#transition(this.#restingAction, null);
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#deltaTime = deltaTime;
    this.#stateMachine.update();
  }

  /**
   *
    * @returns {number}
   */
  get #isResting() {
    return this.#stateMachine.in(HERO_ACTION.EXPLORING)
      || this.#stateMachine.in(HERO_ACTION.BOOSTING_COUNTRY_FINANCES);
  }

  /**
   *
   * @param {string} action
   */
  #payloadFor(action) {
    return this.#stateMachine.in(action) ? this.payload : null;
  }

  /**
   *
   * @param {string} action
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} payload
   */
  #setAction(action, payload) {
    if (payload) {
      this.#transition(action, payload);
    } else if (this.#stateMachine.in(action)) {
      this.finish();
    }
  }

  /**
   *
   * @param {string} action
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} payload
   */
  #transition(action, payload) {
    if (this.#stateMachine.in(action)) {
      this.#stateMachine.currentState.payload = payload;
      this.#stateMachine.currentState.reenter?.(this.#context);
      return;
    }
    this.#pendingPayload = payload;
    this.#stateMachine.changeTo(action);
  }
}
