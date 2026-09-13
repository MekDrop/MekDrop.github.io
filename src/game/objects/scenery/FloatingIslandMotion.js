const BOB_PERIOD = 6.5;
const BOB_HEIGHT_PIXELS = 12;
const SECONDARY_BOB_HEIGHT_PIXELS = 2;
const SWAY_WIDTH_PIXELS = 4;
const STILL_ZOOM = 1;
const FULL_MOTION_START_ZOOM = 1.1;
const GROUNDED_FADE_START_ZOOM = 1.5;
const GROUNDED_ZOOM = 2.5;
const GROUNDING_RESPONSE = 5;

export class FloatingIslandMotion {
  #elapsed = 0;
  #strength = 1;
  #targetStrength = 1;

  constructor({ zoom = 1 }) {
    this.zoom = zoom;
    this.#strength = this.#targetStrength;
  }

  set zoom(value) {
    const revealProgress = Math.max(
      0,
      Math.min(
        1,
        (value - STILL_ZOOM) / (FULL_MOTION_START_ZOOM - STILL_ZOOM),
      ),
    );
    const easedRevealProgress =
      revealProgress * revealProgress * (3 - 2 * revealProgress);
    const fadeProgress = Math.max(
      0,
      Math.min(
        1,
        (value - GROUNDED_FADE_START_ZOOM) /
          (GROUNDED_ZOOM - GROUNDED_FADE_START_ZOOM),
      ),
    );
    const easedFadeProgress =
      fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
    this.#targetStrength = easedRevealProgress * (1 - easedFadeProgress);
    if (value <= STILL_ZOOM) {
      this.#strength = 0;
    }
  }

  update(deltaTime) {
    this.#elapsed += deltaTime;
    const grounding = 1 - Math.exp(-GROUNDING_RESPONSE * deltaTime);
    this.#strength +=
      (this.#targetStrength - this.#strength) * grounding;
    if (this.#targetStrength === 0 && this.#strength < 0.0001) {
      this.#strength = 0;
    }
    if (this.#strength === 0) {
      return { x: 0, y: 0 };
    }
    const phase = (this.#elapsed * Math.PI * 2) / BOB_PERIOD;
    return {
      x: Math.sin(phase * 0.5) * SWAY_WIDTH_PIXELS * this.#strength,
      y: (
        Math.sin(phase) * BOB_HEIGHT_PIXELS +
        Math.sin(phase * 2) * SECONDARY_BOB_HEIGHT_PIXELS
      ) * this.#strength,
    };
  }
}
