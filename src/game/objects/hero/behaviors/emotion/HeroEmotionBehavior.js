import { State, StateMachine } from "yuka";
import { HERO_MOOD } from "../../../../enum/HeroMood.js";
import { HERO_BUFF } from "../../../../enum/HeroBuff.js";
import { HeroHappyEmotionState } from "../../states/emotion/HeroHappyEmotionState.js";
import { HeroAgitatedEmotionState } from "../../states/emotion/HeroAgitatedEmotionState.js";
import { HeroAngryEmotionState } from "../../states/emotion/HeroAngryEmotionState.js";

const ANGRY_DURATION = 8;
const ANGER_LEVEL_DURATION = 2;
const PAT_INTERVAL = 0.22;
const PROVOCATION_INTERVAL = 0.22;
const AGITATION_THRESHOLD = 5;
const SNAP_THRESHOLD = 9;

export class HeroEmotionBehavior {
  /**
   *
    * @type {import("../../../../buffs/BuffSystem.js").BuffSystem}
   */
  #buffs;
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
    * @type {boolean}
   */
  #wasOverstimulated = false;
  /**
   *
    * @type {number}
   */
  #sincePat = Infinity;
  /**
   *
    * @type {number}
   */
  #sinceProvoked = Infinity;
  /**
   *
    * @type {number}
   */
  #elapsed = 0;
  /**
   *
    * @type {number}
   */
  #reactionRevision = 0;

  /**
   *
   * @param {import("../../../../buffs/BuffSystem.js").BuffSystem} buffs
   */
  constructor(buffs) {

    this.#buffs = buffs;

    this.#context = {
      refreshAnger: () => {
        const state = this.#stateMachine.currentState;
        state.pressure = SNAP_THRESHOLD;
        this.#buffs.apply(HERO_BUFF.OVERSTIMULATED, {
          duration: ANGRY_DURATION + (state.level - 1) * ANGER_LEVEL_DURATION,
        });

        this.#wasOverstimulated = true;
      },
    };

    this.#stateMachine = new StateMachine(this.#context);
    this.#stateMachine
      .add(HERO_MOOD.CALM, new State())
      .add(HERO_MOOD.HAPPY, new HeroHappyEmotionState())
      .add(HERO_MOOD.AGITATED, new HeroAgitatedEmotionState())
      .add(HERO_MOOD.ANGRY, new HeroAngryEmotionState());
    this.#stateMachine.changeTo(HERO_MOOD.CALM);
  }

  /**
   *
    * @returns {string}
   */
  get state() {
    const overstimulated = this.#buffs.remaining(HERO_BUFF.OVERSTIMULATED);
    const happyRemaining = this.#buffs.remaining(HERO_BUFF.AFFECTION);
    const kind = this.#stateMachine.currentState.emotion ?? HERO_MOOD.CALM;
    const pressure = this.#stateMachine.currentState.pressure ?? 0;
    const internalLevel = this.#stateMachine.currentState.level ?? 0;
    const level = kind === HERO_MOOD.ANGRY
      ? Math.min(3, internalLevel)
      : internalLevel;
    const angryProgress = kind === HERO_MOOD.ANGRY
      ? Math.max(0, Math.min(1, (level - 1) / 2))
      : 0;
    return {
      kind,
      level,
      reactionProgress: Math.max(0, Math.min(1,
        kind === HERO_MOOD.HAPPY
          ? (pressure - 1) / (AGITATION_THRESHOLD - 1)
          : kind === HERO_MOOD.AGITATED
            ? (pressure - AGITATION_THRESHOLD) / (SNAP_THRESHOLD - AGITATION_THRESHOLD)
            : angryProgress,
      )),
      agitation: kind === HERO_MOOD.ANGRY
        ? (0.65 + angryProgress * 0.35)
          * Math.min(1, overstimulated / ANGRY_DURATION)
        : pressure / SNAP_THRESHOLD,
      remaining: kind === HERO_MOOD.ANGRY
        ? overstimulated
        : kind === HERO_MOOD.AGITATED
            ? Math.max(0, 1.25 - this.#sincePat)
              + (pressure - AGITATION_THRESHOLD) / 0.8
            : happyRemaining,
      patPulse: Math.max(0, 1 - this.#sincePat / 0.45),
      elapsed: this.#elapsed,
    };
  }

  /**
   *
    * @returns {boolean}
   */
  get acceptsActions() {
    return this.#stateMachine.currentState.acceptsActions ?? true;
  }

  get reactionRevision() {
    return this.#reactionRevision;
  }

  attemptAction() {
    if (this.acceptsActions) {
      return true;
    }
    if (this.#sinceProvoked >= PROVOCATION_INTERVAL) {
      this.#sinceProvoked = 0;
      this.#reactionRevision += 1;
      this.#stateMachine.currentState.rejectAction(this.#context);
    }
    return false;
  }

  pat() {
    return this.reactToPat().accepted;
  }

  reactToPat() {
    const currentKind = this.state.kind;
    if (this.#stateMachine.in(HERO_MOOD.ANGRY)
      || this.#sincePat < PAT_INTERVAL) {
      return {
        accepted: false,
        kind: currentKind,
        reinforceAnger: currentKind === HERO_MOOD.ANGRY,
      };
    }
    this.#sincePat = 0;
    const pressure = Math.min(SNAP_THRESHOLD, this.#pressure + 1);
    if (pressure < AGITATION_THRESHOLD) {
      this.#buffs.apply(HERO_BUFF.AFFECTION);
    } else {
      this.#buffs.remove(HERO_BUFF.AFFECTION);
    }
    if (pressure >= SNAP_THRESHOLD) {
      this.#buffs.apply(HERO_BUFF.OVERSTIMULATED);
      this.#wasOverstimulated = true;
    }
    this.#updateState(pressure);
    const kind = this.state.kind;
    return {
      accepted: true,
      kind,
      becameAngry: kind === HERO_MOOD.ANGRY,
      agitated: kind === HERO_MOOD.AGITATED,
    };
  }

  /**
   *
   * @param {number} deltaTime
   */
  advance(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#elapsed += deltaTime;
    this.#sinceProvoked += deltaTime;
    const coolingTime = Number.isFinite(this.#sincePat)
      ? Math.max(0, this.#sincePat + deltaTime - 1.25)
        - Math.max(0, this.#sincePat - 1.25)
      : 0;
    this.#sincePat += deltaTime;
    const overstimulated = this.#buffs.remaining(HERO_BUFF.OVERSTIMULATED);
    if (overstimulated > 0 && this.#stateMachine.in(HERO_MOOD.ANGRY)) {
      const coolingLevel = Math.max(
        1,
        Math.ceil((overstimulated - ANGRY_DURATION) / ANGER_LEVEL_DURATION) + 1,
      );
      this.#stateMachine.currentState.coolDown(coolingLevel);
    }
    let pressure = this.#pressure;
    if (overstimulated > 0) {
      this.#wasOverstimulated = true;
      pressure = SNAP_THRESHOLD * overstimulated / ANGRY_DURATION;
    } else if (this.#wasOverstimulated) {
      pressure = 0;
      this.#wasOverstimulated = false;
    } else if (Number.isFinite(coolingTime)) {
      const wasAgitated = pressure >= AGITATION_THRESHOLD;
      pressure = Math.max(0, pressure - coolingTime * 0.8);
      if (wasAgitated && pressure < AGITATION_THRESHOLD) {
        pressure = 0;
      }
    }
    this.#updateState(pressure);
  }

  reset() {
    this.#buffs.remove(HERO_BUFF.AFFECTION);
    this.#buffs.remove(HERO_BUFF.OVERSTIMULATED);
    this.#wasOverstimulated = false;
    this.#sincePat = Infinity;
    this.#sinceProvoked = Infinity;
    this.#reactionRevision = 0;
    this.#changeState(HERO_MOOD.CALM);
  }

  /**
   *
    * @returns {number}
   */
  get #pressure() {
    return this.#stateMachine.currentState.pressure ?? 0;
  }

  /**
   *
   * @param {number} pressure
   */
  #updateState(pressure) {
    let kind;
    if (this.#buffs.has(HERO_BUFF.OVERSTIMULATED)) {
      kind = HERO_MOOD.ANGRY;
    } else if (pressure >= AGITATION_THRESHOLD) {
      kind = HERO_MOOD.AGITATED;
    } else if (this.#buffs.has(HERO_BUFF.AFFECTION)) {
      kind = HERO_MOOD.HAPPY;
    } else {
      kind = HERO_MOOD.CALM;
    }
    const state = this.#stateMachine.get(kind);
    if ("pressure" in state) {
      state.pressure = pressure;
    }
    this.#changeState(kind);
    this.#stateMachine.update();
  }

  /**
   *
   * @param {string} kind
   */
  #changeState(kind) {
    if (!this.#stateMachine.in(kind)) {
      this.#stateMachine.changeTo(kind);
    }
  }
}
