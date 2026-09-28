import { HERO_BUFF_DEFINITIONS } from "../config/hero-buffs.js";

// Definitions describe effects; this class owns their clocks and stacks.
// Reapplying adds stacks up to the cap and refreshes the whole effect's timer.
export class BuffSystem {
  /**
   *
   * @type {Map}
   */
  #definitions;
  /**
   *
   * @type {Map}
   */
  #active = new Map();
  /**
   *
   * @type {number}
   */
  #revision = 0;

  /**
   *
   * @param {Array} definitions
   */
  constructor(definitions = HERO_BUFF_DEFINITIONS) {
    /**
     *
     * @type {Map}
     */
    this.#definitions = new Map(
      structuredClone(definitions).map(/**
       *
       * @param {import("src/game/GameContracts.js").GameObjectDefinition} definition
       */
      (definition) => [definition.id, definition]),
    );
  }

  get revision() {
    return this.#revision;
  }

  /**
   *
   * @returns {Array}
   */
  get state() {
    return [...this.#active.keys()].map(/**
     *
     * @param {string} id
     */
    (id) => this.get(id));
  }

  /**
   *
   * @param {string} id
   */
  get(id) {
    const effect = this.#active.get(id);
    if (!effect) {
      return null;
    }
    return structuredClone({ ...this.#definitions.get(id), ...effect });
  }

  /**
   *
   * @param {string} id
   */
  has(id) {
    return this.#active.has(id);
  }

  /**
   *
   * @param {string} id
   */
  remaining(id) {
    return this.#active.get(id)?.remaining ?? 0;
  }

  /**
   *
   * @param {string} id
   * @param {{stacks: Array, duration: number}} options
   * @param {Array} options.stacks
   * @param {number} options.duration
   */
  apply(id, { stacks = 1, duration } = {}) {
    const definition = this.#definitions.get(id);
    if (!definition || !Number.isInteger(stacks) || stacks <= 0) {
      return false;
    }
    const remaining = Number.isFinite(duration) && duration > 0
      ? duration
      : definition.duration;
    if (definition.blockedBy?.some(/**
     *
     * @param {pc.Entity} blocker
     */
    (blocker) => this.has(blocker))) {
      return false;
    }
    for (const replaced of definition.replaces ?? []) {
      this.remove(replaced);
    }
    this.#active.set(id, {
      stacks: Math.min(definition.maxStacks, (this.#active.get(id)?.stacks ?? 0) + stacks),
      remaining,
    });
    this.#revision += 1;
    return true;
  }

  /**
   *
   * @param {string} id
   */
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

  /**
   *
   * @param {number} deltaTime
   * @param {{resting: boolean}} options
   * @param {boolean} options.resting
   */
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

  /**
   *
   * @param {string} stat
   * @param {number} baseValue
   */
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
