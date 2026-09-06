const FULL_MOTION_MAX_ZOOM = 1.1;
const HIDDEN_MOTION_MIN_ZOOM = 1.7;
const HIDDEN_TILT_MAX_ZOOM = 1.05;
const FULL_TILT_MIN_ZOOM = 1.3;
const FADE_RESPONSE = 5;
const BOB_PERIOD = 7.5;
const BOB_HEIGHT = 0.34;
const SECONDARY_BOB_HEIGHT = 0.07;
const PITCH_DEGREES = 0.42;
const ROLL_DEGREES = 0.62;

export class FloatingIslandMotion {
  #entity;
  #elapsed = 0;
  #strength = 1;
  #targetStrength = 1;
  #tiltStrength = 0;
  #targetTiltStrength = 0;
  #updateHandle;

  constructor({ app, entity, zoom = 1 }) {
    this.#entity = entity;
    this.setZoom(zoom);
    this.#strength = this.#targetStrength;
    this.#tiltStrength = this.#targetTiltStrength;
    this.#updateHandle = app.on("update", this.#update);
  }

  setZoom(zoom) {
    const fadeRange = HIDDEN_MOTION_MIN_ZOOM - FULL_MOTION_MAX_ZOOM;
    const progress = Math.max(
      0,
      Math.min(1, (zoom - FULL_MOTION_MAX_ZOOM) / fadeRange),
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    this.#targetStrength = 1 - easedProgress;

    const tiltRange = FULL_TILT_MIN_ZOOM - HIDDEN_TILT_MAX_ZOOM;
    const tiltProgress = Math.max(
      0,
      Math.min(1, (zoom - HIDDEN_TILT_MAX_ZOOM) / tiltRange),
    );
    const easedTiltProgress =
      tiltProgress * tiltProgress * (3 - 2 * tiltProgress);
    this.#targetTiltStrength = this.#targetStrength * easedTiltProgress;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity = null;
  }

  #update = (deltaTime) => {
    if (!this.#entity) {
      return;
    }
    this.#elapsed += deltaTime;
    const fade = 1 - Math.exp(-FADE_RESPONSE * deltaTime);
    this.#strength += (this.#targetStrength - this.#strength) * fade;
    this.#tiltStrength +=
      (this.#targetTiltStrength - this.#tiltStrength) * fade;

    const phase = (this.#elapsed * Math.PI * 2) / BOB_PERIOD;
    const bob =
      Math.sin(phase) * BOB_HEIGHT +
      Math.sin(phase * 0.47) * SECONDARY_BOB_HEIGHT;
    const pitch = Math.sin(phase * 0.63) * PITCH_DEGREES;
    const roll = -Math.sin(phase * 0.78) * ROLL_DEGREES;

    this.#entity.setLocalPosition(0, bob * this.#strength, 0);
    this.#entity.setLocalEulerAngles(
      pitch * this.#tiltStrength,
      0,
      roll * this.#tiltStrength,
    );
  };
}
