/**
 * Adapts the existing signal tower's real strike mechanism to sabotage leases.
 * Artillery can expose beginSabotage directly; no sibling class imports needed.
 */
export class WireGremlinSignalTower {
  /**
   * @type {WeakMap<import("../../signal-bell/SignalBell.js").SignalBell, WireGremlinSignalTower>}
   */
  static #targets = new WeakMap();
  /**
   * @type {import("../../signal-bell/SignalBell.js").SignalBell}
   */
  #bell;
  /**
   * @type {Set<{source: import("./WireGremlin.js").WireGremlin}>}
   */
  #leases = new Set();
  /**
   * @type {Function|null}
   */
  #originalStrike = null;
  /**
   * @type {Function|null}
   */
  #guard = null;

  /**
   * @param {import("../../signal-bell/SignalBell.js").SignalBell} bell
   */
  constructor(bell) {
    this.#bell = bell;
    this.isSabotageTower = true;
    this.sabotageHeight = 0.6;
    this.sabotageReach = 0.8;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  static forActor(actor) {
    if (actor.isSabotageTower && typeof actor.beginSabotage === "function") {
      return actor;
    }
    if (typeof actor.strike !== "function" || typeof actor.beginRinging !== "function" || !actor.visualRoots?.[0]) {
      return null;
    }
    if (!this.#targets.has(actor)) {
      this.#targets.set(actor, new WireGremlinSignalTower(actor));
    }

    return this.#targets.get(actor);
  }

  /**
   * @returns {import("playcanvas").Entity|null}
   */
  get entity() {
    return this.#bell.visualRoots?.[0] ?? null;
  }

  /**
   * Aim at the authored left timber, rather than the open center of the frame.
   * The model transform includes the bell's authored scale and rotation.
   * @returns {import("playcanvas").Vec3|null}
   */
  get sabotageApproachPosition() {
    const root = this.entity;
    if (!root) {
      return null;
    }
    const model = root.children[0];
    const point = root.getPosition().clone();
    if (model) {
      point.set(-0.55, 0, 0);
      model.getWorldTransform().transformPoint(point, point);
    }

    return point;
  }

  /**
   * @returns {boolean}
   */
  get alive() {
    return this.entity?.enabled === true;
  }

  /**
   * @returns {boolean}
   */
  get disabled() {
    return this.#leases.size > 0;
  }

  /**
   * @param {import("./WireGremlin.js").WireGremlin} source
   */
  beginSabotage(source) {
    if (!this.#leases.size) {
      this.#originalStrike = this.#bell.strike;
      this.#guard = this.#strike.bind(this);
      this.#bell.strike = this.#guard;
    }
    const lease = { source };
    this.#leases.add(lease);

    return () => {
      this.#leases.delete(lease);
      if (!this.#leases.size && this.#bell.strike === this.#guard) {
        this.#bell.strike = this.#originalStrike;
      }
    };
  }

  #strike() {
    if (!this.#leases.size) {
      this.#originalStrike?.call(this.#bell);
    }
  }
}
