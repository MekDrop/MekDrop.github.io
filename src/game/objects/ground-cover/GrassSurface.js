const HERO_RECOVERY_TIME = 0.65;
const VIEW_RECOVERY_TIME = 0.5;
const MAXIMUM_RUNNING_SPEED = 6.3;
const STILL_ZOOM = 1;
const FULL_VIEW_MOTION_ZOOM = 1.1;

export class GrassSurface {
  #terrainMaterials;
  #updateHandle;
  #elapsed = 0;
  #lastHeroMotionAt = Number.NEGATIVE_INFINITY;
  #lastViewMotionAt = Number.NEGATIVE_INFINITY;
  #heroPosition = [0, -1000, 0];
  #heroDirection = [0, 1];
  #heroInfluence = 0;
  #viewInfluence = 0;
  #viewMotionScale = 0;

  constructor({ app, terrainMaterials = [], zoom = 1 }) {
    this.#terrainMaterials = terrainMaterials;
    this.#setShaderParameters(0, 0);
    this.zoom = zoom;
    this.#updateHandle = app.on("update", this.#update);
  }

  set zoom(value) {
    const progress = Math.max(
      0,
      Math.min(
        1,
        (value - STILL_ZOOM) / (FULL_VIEW_MOTION_ZOOM - STILL_ZOOM),
      ),
    );
    this.#viewMotionScale = progress * progress * (3 - 2 * progress);
    if (this.#viewMotionScale === 0) {
      this.#viewInfluence = 0;
      for (const material of this.#terrainMaterials) {
        material.setParameter("uGrassMotionInfluence", 0);
      }
    }
  }

  applyHeroInteraction({ x, y, z }, movement) {
    if (!movement) {
      return;
    }

    this.#heroPosition[0] = x;
    this.#heroPosition[1] = y;
    this.#heroPosition[2] = z;
    this.#heroDirection[0] = movement.direction.x;
    this.#heroDirection[1] = movement.direction.z;

    if (movement.speed <= 0.08) {
      return;
    }

    this.#heroInfluence = Math.min(
      1,
      0.42 +
        movement.speed / MAXIMUM_RUNNING_SPEED +
        (movement.running ? 0.18 : 0),
    );
    this.#lastHeroMotionAt = this.#elapsed;
  }

  applyViewInteraction(deltaX, deltaY) {
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 0.01) {
      return;
    }

    this.#viewInfluence = Math.min(1, 0.25 + distance / 18);
    this.#lastViewMotionAt = this.#elapsed;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#terrainMaterials = [];
  }

  #setShaderParameters(heroInfluence, motionInfluence) {
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassHeroPosition", this.#heroPosition);
      material.setParameter("uGrassHeroDirection", this.#heroDirection);
      material.setParameter("uGrassHeroInfluence", heroInfluence);
      material.setParameter("uGrassMotionInfluence", motionInfluence);
    }
  }

  #update = (deltaTime) => {
    this.#elapsed += Math.min(deltaTime, 0.1);
    const heroMotionAge = this.#elapsed - this.#lastHeroMotionAt;
    const heroRecovery = Math.max(
      0,
      1 - heroMotionAge / HERO_RECOVERY_TIME,
    );
    const viewMotionAge = this.#elapsed - this.#lastViewMotionAt;
    const viewRecovery = Math.max(
      0,
      1 - viewMotionAge / VIEW_RECOVERY_TIME,
    );
    const heroInfluence = this.#heroInfluence * heroRecovery * heroRecovery;
    const viewInfluence =
      this.#viewInfluence *
      viewRecovery *
      viewRecovery *
      this.#viewMotionScale;
    this.#setShaderParameters(heroInfluence, viewInfluence);
  };
}
