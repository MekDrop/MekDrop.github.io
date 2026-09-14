import { HERO_BUFF_DEFINITIONS } from "../config/hero-buffs.js";

// Definitions describe effects; this class owns their clocks and stacks.
// Reapplying adds stacks up to the cap and refreshes the whole effect's timer.
export class BuffSystem {
  #definitions;
  #active = new Map();
  #revision = 0;

  constructor(definitions = HERO_BUFF_DEFINITIONS) {
    this.#definitions = new Map(
      structuredClone(definitions).map((definition) => [definition.id, definition]),
    );
  }

  get revision() {
    return this.#revision;
  }

  get state() {
    return [...this.#active.keys()].map((id) => this.get(id));
  }

  get(id) {
    const effect = this.#active.get(id);
    if (!effect) {
      return null;
    }
    return structuredClone({ ...this.#definitions.get(id), ...effect });
  }

  has(id) {
    return this.#active.has(id);
  }

  remaining(id) {
    return this.#active.get(id)?.remaining ?? 0;
  }

  apply(id, { stacks = 1 } = {}) {
    const definition = this.#definitions.get(id);
    if (!definition || !Number.isInteger(stacks) || stacks <= 0) {
      return false;
    }
    if (definition.blockedBy?.some((blocker) => this.has(blocker))) {
      return false;
    }
    for (const replaced of definition.replaces ?? []) {
      this.remove(replaced);
    }
    this.#active.set(id, {
      stacks: Math.min(definition.maxStacks, (this.#active.get(id)?.stacks ?? 0) + stacks),
      remaining: definition.duration,
    });
    this.#revision += 1;
    return true;
  }

  remove(id) {
    const removed = this.#active.delete(id);
    if (removed) {
      this.#revision += 1;
    }
    return removed;
  }

  clear() {
    if (this.#active.size) {
      this.#active.clear();
      this.#revision += 1;
    }
  }

  advance(deltaTime, { resting = true } = {}) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    for (const [id, effect] of this.#active) {
      if (this.#definitions.get(id).requiresRest && !resting) {
        continue;
      }
      effect.remaining = Math.max(0, effect.remaining - deltaTime);
      if (effect.remaining <= 1e-9) {
        this.remove(id);
      }
    }
  }

  modifyStat(stat, baseValue) {
    let flat = 0;
    let percent = 0;
    for (const [id, effect] of this.#active) {
      const modifier = this.#definitions.get(id).modifiers[stat];
      if (modifier) {
        flat += (modifier.flat ?? 0) * effect.stacks;
        percent += (modifier.percent ?? 0) * effect.stacks;
      }
    }
    // Add bonuses and penalties before scaling the base to avoid order effects.
    return Math.max(0, (baseValue + flat) * (1 + percent));
  }
}
