/** Places authored steps along a route, with turns made before/after walking. */
export class TerraceInspectorWalk {
  static sample({ start, end, startYaw, endYaw, elapsed, duration, scale }) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const distance = Math.hypot(dx, dz);
    const heading = distance > 0.0001 ? Math.atan2(dx, dz) * 180 / Math.PI : startYaw;
    const firstTurn = this.#delta(startYaw, heading);
    const lastTurn = this.#delta(heading, endYaw);
    const turnIn = Math.abs(firstTurn) / 180 * 0.8;
    const turnOut = Math.abs(lastTurn) / 180 * 0.8;
    const walkDuration = Math.max(0.1, duration - turnIn - turnOut);
    const time = Math.max(0, Math.min(duration, elapsed));
    if (time < turnIn) {
      const t = time / turnIn;
      return { ...start, yaw: startYaw + firstTurn * this.#ease(t),
        action: "turn", animationTime: t, progress: 0 };
    }
    if (time < turnIn + walkDuration) {
      const progress = this.#ease((time - turnIn) / walkDuration);
      // End on a planted half-cycle. The model's full stride covers ~1.25 units.
      const cycles = Math.max(0.5, Math.round(distance / scale / 1.25 * 2) / 2);
      return {
        x: start.x + dx * progress,
        y: start.y + (end.y - start.y) * progress,
        z: start.z + dz * progress,
        yaw: heading, action: "walk", animationTime: cycles * progress, progress,
      };
    }
    const t = turnOut > 0 ? Math.min(1, (time - turnIn - walkDuration) / turnOut) : 1;
    return { ...end, yaw: heading + lastTurn * this.#ease(t),
      action: t < 1 ? "turn" : "idle", animationTime: t, progress: 1 };
  }

  static #delta(from, to) {
    return ((to - from + 540) % 360) - 180;
  }

  static #ease(t) {
    return t * t * (3 - 2 * t);
  }
}
