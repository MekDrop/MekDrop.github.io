import { KingDozingState } from "../states/terrace/king/KingDozingState.js";
import { KingWakingState } from "../states/terrace/king/KingWakingState.js";
import { KingLookingAroundState } from "../states/terrace/king/KingLookingAroundState.js";
import { KingBoredState } from "../states/terrace/king/KingBoredState.js";
import { ROYAL_WALK_SPEED } from "../../../enum/RoyalWalkSpeed.js";
import { KingCombatTrainingState } from "../states/terrace/king/KingCombatTrainingState.js";
import { KingEnterTrainingState } from "../states/terrace/king/KingEnterTrainingState.js";
import { KingFinishTrainingState } from "../states/terrace/king/KingFinishTrainingState.js";
import { KingOnThroneState } from "../states/terrace/king/KingOnThroneState.js";
import { KingPrepareTrainingState } from "../states/terrace/king/KingPrepareTrainingState.js";
import { KingReturnToThroneState } from "../states/terrace/king/KingReturnToThroneState.js";
import { RoyalTerraceActivityBehavior } from "../rooms/terrace/RoyalTerraceActivityBehavior.js";

export class KingTrainingBehavior extends RoyalTerraceActivityBehavior {
  /**
   * @type {number}
   */
  #wait = 8;
  /**
   * @type {boolean}
   */
  #advancingIdle = false;
  /**
   * @type {boolean}
   */
  throneIdleAvailable = false;

  /**
   * @returns {boolean}
   */
  get onThrone() {
    return super.onThrone || this.#isIdle;
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#advancingIdle || super.active;
  }

  /**
   * @returns {boolean}
   */
  get requested() {
    return super.requested;
  }

  set requested(value) {
    if (value && this.#isIdle) {
      this.transition(KingOnThroneState.name);
    }
    super.requested = value;
  }

  /**
   * @returns {boolean}
   */
  get #isIdle() {
    return [KingDozingState.name, KingWakingState.name, KingLookingAroundState.name, KingBoredState.name].includes(this.phase);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0 || this.reacting) {
      return;
    }
    if (!this.throneIdleAvailable && this.onThrone) {
      if (this.#isIdle) {
        this.transition(KingOnThroneState.name);
      }
      this.#wait = 8;
    } else if (super.onThrone && !this.requested) {
      this.#wait -= deltaTime;
      if (this.#wait <= 0) {
        const states = [KingDozingState, KingLookingAroundState, KingBoredState];
        this.transition(states[Math.floor(Math.random() * states.length)].name);
      }
    }
    this.#advancingIdle = this.#isIdle;
    try {
      super.update(deltaTime);
    } finally {
      this.#advancingIdle = false;
    }
  }

  /**
   * @param {string} phase
   */
  nextPhase(phase) {
    if (phase === KingDozingState.name) {
      return KingWakingState.name;
    }
    if ([KingWakingState.name, KingLookingAroundState.name, KingBoredState.name].includes(phase)) {
      this.#wait = 10 + Math.random() * 18;

      return KingOnThroneState.name;
    }

    return super.nextPhase(phase);
  }

  /**
   *
   * @param {(atThrone: boolean) => void} onThroneChange
   */
  constructor(onThroneChange) {
    const walkSpeed = ROYAL_WALK_SPEED.KING;
    const walkDuration = 0.7 + 2.5 / walkSpeed;
    super({
      onThroneChange,
      walkSpeed,
      states: [
        new KingOnThroneState(),
        new KingDozingState(),
        new KingWakingState(),
        new KingLookingAroundState(),
        new KingBoredState(),
        new KingEnterTrainingState(walkDuration),
        new KingPrepareTrainingState(1.4),
        new KingCombatTrainingState(),
        new KingFinishTrainingState(1.4),
        new KingReturnToThroneState(walkDuration),
      ],
      phases: {
        throne: KingOnThroneState.name,
        enter: KingEnterTrainingState.name,
        prepare: KingPrepareTrainingState.name,
        activity: KingCombatTrainingState.name,
        finish: KingFinishTrainingState.name,
        return: KingReturnToThroneState.name,
      },
    });
  }
}
