import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { CASTLE_LEISURE_PHASE as PHASE } from "../../enum/CastleLeisurePhase.js";

/** The visit choreography uses game time, so pausing and disposal leave no timers. */
export class CastleLeisureSequence {
  #kind;
  #present = false;
  #phase = PHASE.DORMANT;
  #elapsed = 0;
  #delivery = 0;
  #installed = 0;
  #visitId = 0;

  constructor(kind) {
    this.#kind = kind;
  }

  get visitId() {
    return this.#visitId;
  }

  get phase() {
    return this.#phase;
  }

  get elapsed() {
    return this.#elapsed;
  }

  get active() {
    return this.#phase !== PHASE.DORMANT;
  }

  get cargo() {
    return this.#kind === "queen"
      ? "sunbed"
      : ["table", "chair", "tea"][this.#delivery];
  }

  get installedCount() {
    return this.#installed;
  }

  get walkSpeed() {
    const royalWalking = this.#phase === PHASE.ROYAL_ENTER ||
      this.#phase === PHASE.ROYAL_EXIT;
    return royalWalking ? ROYAL_WALK_SPEED[this.#kind.toUpperCase()] : 1;
  }

  get duration() {
    switch (this.#phase) {
      case PHASE.SERVANT_ENTER:
      case PHASE.SERVANT_EXIT:
      case PHASE.ROYAL_ENTER:
      case PHASE.ROYAL_EXIT:
      case PHASE.SERVANT_RETURN:
      case PHASE.SERVANT_LEAVE:
        // Keep the door-opening and arrival pauses independent of walking pace.
        return 0.7 + 2.5 / this.walkSpeed;
      case PHASE.FURNISH:
      case PHASE.PACK:
        return 2;
      case PHASE.POUR:
        return 3;
      case PHASE.SETTLE:
        return this.#kind === "queen" ? 4.5 : 1.4;
      case PHASE.RISE:
        return this.#kind === "queen" ? 3.8 : 1.4;
      case PHASE.CLEANUP_DELAY:
        return 2.5;
      default:
        return Infinity;
    }
  }

  get progress() {
    return Math.min(1, this.#elapsed / this.duration);
  }

  set present(value) {
    this.#present = Boolean(value);
    if (this.#present && this.#phase === PHASE.DORMANT) {
      this.#enter(this.#kind === "king" ? PHASE.ROYAL_ENTER : PHASE.SERVANT_ENTER);
    } else if (!this.#present && this.#phase === PHASE.LEISURE) {
      this.#enter(PHASE.RISE);
    }
  }

  update(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0 || !this.active) {
      return;
    }
    this.#elapsed += deltaTime;
    while (this.#elapsed >= this.duration) {
      const remaining = this.#elapsed - this.duration;
      this.#enter(this.#next());
      this.#elapsed = remaining;
    }
  }

  reset() {
    this.#present = false;
    this.#delivery = 0;
    this.#installed = 0;
    this.#enter(PHASE.DORMANT);
  }

  #enter(phase) {
    if (phase === PHASE.SERVANT_ENTER && this.#installed === 0) {
      this.#visitId += 1;
    }
    this.#phase = phase;
    this.#elapsed = 0;
  }

  #next() {
    switch (this.#phase) {
      case PHASE.SERVANT_ENTER:
        return PHASE.FURNISH;
      case PHASE.FURNISH:
        this.#installed += 1;
        return this.#kind === "princess" && this.#delivery === 2
          ? PHASE.POUR
          : PHASE.SERVANT_EXIT;
      case PHASE.POUR:
        return PHASE.SERVANT_EXIT;
      case PHASE.SERVANT_EXIT:
        if (!this.#present) {
          this.#delivery = this.#installed - 1;
          return PHASE.CLEANUP_DELAY;
        }
        if (this.#kind === "princess" && this.#delivery < 2) {
          this.#delivery += 1;
          return PHASE.SERVANT_ENTER;
        }
        return PHASE.ROYAL_ENTER;
      case PHASE.ROYAL_ENTER:
        return this.#present ? PHASE.SETTLE : PHASE.ROYAL_EXIT;
      case PHASE.SETTLE:
        return this.#present ? PHASE.LEISURE : PHASE.RISE;
      case PHASE.RISE:
        return PHASE.ROYAL_EXIT;
      case PHASE.ROYAL_EXIT:
        this.#delivery = this.#installed - 1;
        return this.#kind === "king" ? this.#restart() : PHASE.CLEANUP_DELAY;
      case PHASE.CLEANUP_DELAY:
        return PHASE.SERVANT_RETURN;
      case PHASE.SERVANT_RETURN:
        return PHASE.PACK;
      case PHASE.PACK:
        this.#installed -= 1;
        return PHASE.SERVANT_LEAVE;
      case PHASE.SERVANT_LEAVE:
        if (this.#installed > 0) {
          this.#delivery = this.#installed - 1;
          return PHASE.SERVANT_RETURN;
        }
        return this.#restart();
      default:
        return PHASE.DORMANT;
    }
  }

  #restart() {
    this.#delivery = 0;
    if (!this.#present) {
      return PHASE.DORMANT;
    }
    return this.#kind === "king" ? PHASE.ROYAL_ENTER : PHASE.SERVANT_ENTER;
  }
}
