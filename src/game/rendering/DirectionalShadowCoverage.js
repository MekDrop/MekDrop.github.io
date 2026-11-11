import { PROJECTION_ORTHOGRAPHIC } from "playcanvas";

/**
 * Fits sunlight coverage to orthographic ground receivers while retaining
 * distant coverage for high orbit cameras and the perspective gameplay range.
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
    // A fixed distance can miss distant orbit receivers, while the full camera
    // depth wastes most shadow texels on sky. Perspective keeps a local budget.
    const shadowDistance = this.#camera.projection === PROJECTION_ORTHOGRAPHIC
      ? this.#orthographicDistance()
      : Math.min(24, this.#camera.farClip);
    if (this.#light.shadowDistance !== shadowDistance) {
      this.#light.shadowDistance = shadowDistance;
    }
  }

  /**
   * Keep sky beyond the ground out of the single shadow atlas. The camera's
   * far plane also contains clouds; spending texels there erases thin rafters.
   * @returns {number}
   */
  #orthographicDistance() {
    const camera = this.#camera;
    const node = camera.entity ?? camera.node;
    if (!node || node.forward.y >= -0.01) {
      return camera.farClip;
    }
    // Include the highest orthographic corner and a conservative basement /
    // floating-island depth below world ground, including offscreen casters.
    const upperCorner = camera.orthoHeight * (Math.abs(node.up.y) +
      Math.abs(node.right.y) * camera.aspectRatio);
    const groundDepth = (node.getPosition().y + upperCorner + 32) / -node.forward.y;

    return Math.min(camera.farClip, Math.max(24, groundDepth));
  }
}
