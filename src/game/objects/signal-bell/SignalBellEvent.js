/**
 * Capability-only primary alarm dispatch. The strike/audio/rope keep their clock.
 */
export class SignalBellEvent {
  /**
   * @type {number}
   */
  static #sequence = 0;

  /**
   * @param {{position:import("playcanvas").Vec3,definition?:{id:string}}} source
   * @param {Iterable<import("../enemies/shared/Enemy.js").Enemy>} actors
   * @param {number} radius
   * @returns {string}
   */
  static dispatch(source, actors, radius = 12) {
    const eventId = `tower-bell:${source.definition?.id ?? "bell"}:${++this.#sequence}`;
    for (const actor of actors) {
      if (!actor.isEnemy || actor.alive === false || typeof actor.onBellRung !== "function") {
        continue;
      }
      const position = actor.position ?? actor.entity?.getPosition();
      if (!position || source.position.distance(position) > radius) {
        continue;
      }
      actor.onBellRung({
        eventId,
        secondary: false,
        source,
        duration: 2,
      });
    }

    return eventId;
  }
}
