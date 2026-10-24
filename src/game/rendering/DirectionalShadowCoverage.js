import { PROJECTION_ORTHOGRAPHIC } from "playcanvas";

/**
 * Keeps orthographic receivers inside the sun's shadow frustum, including when
 * an orbit or zoomed-out camera sees beyond the usual gameplay distance.
 */
export class DirectionalShadowCoverage {
  /**
   * @type {import("playcanvas").LightComponent}
   */
  #light;
  /**
   * @type {import("playcanvas").CameraComponent}
   */
  #camera;

  /**
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").LightComponent} light
   * @param {import("playcanvas").CameraComponent} camera
   */
  constructor(app, light, camera) {
    this.#light = light;
    this.#camera = camera;
    this.#update();
    // Run after camera updates and before the Engine culls shadow casters.
    const subscription = app.on("prerender", this.#update, this);
    light.entity.once("destroy", () => subscription.off());
  }

  #update() {
    // A fixed world-space distance can end in front of visible orthographic
    // geometry. Cover its full depth instead; perspective keeps a local budget.
    const shadowDistance = this.#camera.projection === PROJECTION_ORTHOGRAPHIC
      ? this.#camera.farClip
      : Math.min(24, this.#camera.farClip);
    if (this.#light.shadowDistance !== shadowDistance) {
      this.#light.shadowDistance = shadowDistance;
    }
  }
}
