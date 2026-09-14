import { HERO_MOOD } from "../../enum/HeroMood.js";
import { HERO_BUFF } from "../../enum/HeroBuff.js";

const ANGRY_DURATION = 8;
const PAT_INTERVAL = 0.22;
const AGITATION_THRESHOLD = 5;
const SNAP_THRESHOLD = 9;

export class HeroPatMood {
  #buffs;
  #pressure = 0;
  #wasOverstimulated = false;
  #sincePat = Infinity;
  #elapsed = 0;

  constructor(buffs) {
    this.#buffs = buffs;
  }

  get state() {
    const overstimulated = this.#buffs.remaining(HERO_BUFF.OVERSTIMULATED);
    const happyRemaining = this.#buffs.remaining(HERO_BUFF.AFFECTION);
    const kind = overstimulated > 0
      ? HERO_MOOD.ANGRY
      : this.#pressure >= AGITATION_THRESHOLD
        ? HERO_MOOD.AGITATED
        : happyRemaining > 0 ? HERO_MOOD.HAPPY : HERO_MOOD.CALM;
    return {
      kind,
      reactionProgress: Math.max(0, Math.min(1,
        kind === HERO_MOOD.HAPPY
          ? (this.#pressure - 1) / (AGITATION_THRESHOLD - 1)
          : kind === HERO_MOOD.AGITATED
            ? (this.#pressure - AGITATION_THRESHOLD) / (SNAP_THRESHOLD - AGITATION_THRESHOLD)
            : 0,
      )),
      agitation: this.#pressure / SNAP_THRESHOLD,
      remaining: kind === HERO_MOOD.ANGRY
        ? overstimulated
        : kind === HERO_MOOD.AGITATED
            ? Math.max(0, 1.25 - this.#sincePat)
              + (this.#pressure - AGITATION_THRESHOLD) / 0.8
            : happyRemaining,
      patPulse: Math.max(0, 1 - this.#sincePat / 0.45),
      elapsed: this.#elapsed,
    };
  }

  pat() {
    if (this.#buffs.has(HERO_BUFF.OVERSTIMULATED)
      || this.#sincePat < PAT_INTERVAL) {
      return false;
    }
    this.#sincePat = 0;
    this.#pressure = Math.min(SNAP_THRESHOLD, this.#pressure + 1);
    if (this.#pressure < AGITATION_THRESHOLD) {
      this.#buffs.apply(HERO_BUFF.AFFECTION);
    } else {
      this.#buffs.remove(HERO_BUFF.AFFECTION);
    }
    if (this.#pressure >= SNAP_THRESHOLD) {
      this.#buffs.apply(HERO_BUFF.OVERSTIMULATED);
      this.#wasOverstimulated = true;
    }
    return true;
  }

  advance(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#elapsed += deltaTime;
    const coolingTime = Number.isFinite(this.#sincePat)
      ? Math.max(0, this.#sincePat + deltaTime - 1.25)
        - Math.max(0, this.#sincePat - 1.25)
      : 0;
    this.#sincePat += deltaTime;
    const overstimulated = this.#buffs.remaining(HERO_BUFF.OVERSTIMULATED);
    if (overstimulated > 0) {
      this.#wasOverstimulated = true;
      this.#pressure = SNAP_THRESHOLD * overstimulated / ANGRY_DURATION;
    } else if (this.#wasOverstimulated) {
      this.#pressure = 0;
      this.#wasOverstimulated = false;
    } else if (Number.isFinite(coolingTime)) {
      const wasAgitated = this.#pressure >= AGITATION_THRESHOLD;
      this.#pressure = Math.max(0, this.#pressure - coolingTime * 0.8);
      if (wasAgitated && this.#pressure < AGITATION_THRESHOLD) {
        this.#pressure = 0;
      }
    }
  }

  reset() {
    this.#pressure = 0;
    this.#buffs.remove(HERO_BUFF.AFFECTION);
    this.#buffs.remove(HERO_BUFF.OVERSTIMULATED);
    this.#wasOverstimulated = false;
    this.#sincePat = Infinity;
  }
}
