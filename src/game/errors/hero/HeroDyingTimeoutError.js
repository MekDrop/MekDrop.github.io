export class HeroDyingTimeoutError extends Error {
  /**
   * @param {string} action
   * @param {number} elapsed
   */
  constructor(action, elapsed) {
    super(`Hero remained in dying state "${action}" for ${elapsed} seconds; forcing respawn.`);
    this.name = "HeroDyingTimeoutError";
    this.action = action;
    this.elapsed = elapsed;
  }
}
