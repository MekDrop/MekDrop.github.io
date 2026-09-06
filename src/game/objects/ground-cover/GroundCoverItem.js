const WIND_TILT_DEGREES = 18;
const WIND_DECAY = 4.5;
const WIND_RESPONSE = 18;
const FLOWER_TRAMPLE_ANGLE = 68;
const FLOWER_TRAMPLE_HOLD = 0.38;
const FLOWER_RECOVERY_TIME = 1.35;
const MUSHROOM_DISAPPEAR_TIME = 0.22;

export class GroundCoverItem {
  #entity;
  #position;
  #flexibility;
  #stepReaction;
  #phase;
  #elapsed = 0;
  #targetTiltX = 0;
  #targetTiltZ = 0;
  #tiltX = 0;
  #tiltZ = 0;
  #trampleAmount = 0;
  #trampleHold = 0;
  #trampleTiltX = 0;
  #trampleTiltZ = 0;
  #disappearAmount = 0;

  constructor({
    pc,
    modelLibrary,
    modelUrl,
    variant,
    x,
    y,
    z,
    rotation,
    scale,
    flexibility,
    stepReaction,
    phase,
  }) {
    this.#position = { x, y, z };
    this.#flexibility = flexibility;
    this.#stepReaction = stepReaction;
    this.#phase = phase;
    this.#entity = new pc.Entity(`Ground cover ${variant}`);
    this.#entity.setLocalPosition(x, y, z);

    const model = modelLibrary.instantiateMerged(modelUrl);
    model.setLocalEulerAngles(0, rotation, 0);
    model.setLocalScale(scale, scale, scale);
    this.#entity.addChild(model);
  }

  get entity() {
    return this.#entity;
  }

  get position() {
    return this.#position;
  }

  applyWind(directionX, directionZ, strength) {
    if (this.#disappearAmount > 0) {
      return;
    }
    const tilt = WIND_TILT_DEGREES * strength * this.#flexibility;
    const targetX = directionZ * tilt;
    const targetZ = -directionX * tilt;
    if (Math.abs(targetX) > Math.abs(this.#targetTiltX)) {
      this.#targetTiltX = targetX;
    }
    if (Math.abs(targetZ) > Math.abs(this.#targetTiltZ)) {
      this.#targetTiltZ = targetZ;
    }
  }

  stepOn(directionX, directionZ) {
    if (this.#stepReaction === "disappear") {
      this.#disappearAmount = Math.max(this.#disappearAmount, 0.001);
      return;
    }
    if (this.#stepReaction !== "recover") {
      return;
    }

    const directionLength = Math.hypot(directionX, directionZ) || 1;
    this.#trampleTiltX =
      (directionZ / directionLength) * FLOWER_TRAMPLE_ANGLE;
    this.#trampleTiltZ =
      (-directionX / directionLength) * FLOWER_TRAMPLE_ANGLE;
    this.#trampleAmount = 1;
    this.#trampleHold = FLOWER_TRAMPLE_HOLD;
  }

  advance(deltaTime) {
    if (this.#disappearAmount > 0) {
      this.#advanceDisappearance(deltaTime);
      return;
    }
    this.#elapsed += deltaTime;
    const decay = Math.exp(-deltaTime * WIND_DECAY);
    this.#targetTiltX *= decay;
    this.#targetTiltZ *= decay;
    const response = 1 - Math.exp(-deltaTime * WIND_RESPONSE);
    this.#tiltX += (this.#targetTiltX - this.#tiltX) * response;
    this.#tiltZ += (this.#targetTiltZ - this.#tiltZ) * response;

    const ambient = this.#flexibility * 0.45;
    const ambientX = Math.sin(this.#elapsed * 1.35 + this.#phase) * ambient;
    const ambientZ =
      Math.sin(this.#elapsed * 1.08 + this.#phase * 1.7) * ambient * 0.7;
    if (this.#trampleHold > 0) {
      this.#trampleHold = Math.max(0, this.#trampleHold - deltaTime);
    } else {
      this.#trampleAmount = Math.max(
        0,
        this.#trampleAmount - deltaTime / FLOWER_RECOVERY_TIME,
      );
    }
    const trampleEase =
      this.#trampleAmount * this.#trampleAmount * (3 - 2 * this.#trampleAmount);
    this.#entity.setLocalEulerAngles(
      this.#tiltX + ambientX + this.#trampleTiltX * trampleEase,
      0,
      this.#tiltZ + ambientZ + this.#trampleTiltZ * trampleEase,
    );
    this.#entity.setLocalScale(1, 1 - trampleEase * 0.22, 1);
  }

  #advanceDisappearance(deltaTime) {
    this.#disappearAmount = Math.min(
      1,
      this.#disappearAmount + deltaTime / MUSHROOM_DISAPPEAR_TIME,
    );
    const progress = this.#disappearAmount;
    const width = 1 + Math.sin(progress * Math.PI) * 0.22;
    this.#entity.setLocalScale(width, Math.max(0.02, 1 - progress), width);
    this.#entity.setLocalEulerAngles(progress * 12, 0, progress * -18);
    if (progress >= 1) this.#entity.enabled = false;
  }
}
