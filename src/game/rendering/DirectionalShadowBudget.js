/**
 * Reuses the sunlight shadow map between refreshes in first-person mode.
 */
export class DirectionalShadowBudget {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").LightComponent}
   */
  #light;
  /**
   * @type {boolean}
   */
  #limited = false;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {number}
   */
  #frames = 0;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").LightComponent} light
   */
  constructor(pc, light) {
    this.#pc = pc;
    this.#light = light;
  }

  /**
   * @param {boolean} limited
   */
  set limited(limited) {
    this.#limited = limited;
    this.#elapsed = 0;
    this.#frames = 0;
    this.#light.shadowUpdateMode = limited
      ? this.#pc.SHADOWUPDATE_THISFRAME
      : this.#pc.SHADOWUPDATE_REALTIME;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.#limited) {
      return;
    }
    this.#elapsed += Math.max(0, deltaTime);
    this.#frames += 1;
    const interval = 1 / 15;
    // A time-only limit refreshes every frame below 15 FPS, precisely when
    // shadow reuse is needed most. Keep three intervening frames at any rate.
    if (this.#elapsed < interval || this.#frames < 4) {
      return;
    }
    this.#elapsed %= interval;
    this.#frames = 0;
    // The renderer consumes THISFRAME and retains the existing shadow texture
    // on intervening frames, rather than disabling shadows on the material.
    this.#light.shadowUpdateMode = this.#pc.SHADOWUPDATE_THISFRAME;
  }
}
