import { MushroomDebris } from "./MushroomDebris.js";

const WIND_TILT_DEGREES = 18;
const WIND_DECAY = 4.5;
const WIND_RESPONSE = 18;
const FLOWER_TRAMPLE_ANGLE = 68;
const FLOWER_TRAMPLE_HOLD = 0.38;
const FLOWER_RECOVERY_TIME = 1.35;
const MUSHROOM_CRUSH_TIME = 0.24;
const MUSHROOM_CRUSH_TILT = 34;
const MUSHROOM_CRUSH_COMPRESSION = 0.32;
const MUSHROOM_CRUSH_SPREAD = 0.04;

export class GroundCoverItem {
  #pc;
  #app;
  #entity;
  #model;
  #modelLibrary;
  #modelUrl;
  #variant;
  #position;
  #scale;
  #rotation;
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
  #ambientMotion = 1;
  #destroyed = false;
  #debris = null;
  #crushElapsed = 0;
  #crushDirectionX = 0;
  #crushDirectionZ = 1;

  constructor({
    pc,
    app,
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
    ambientMotion = 1,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#variant = variant;
    this.#position = { x, y, z };
    this.#scale = scale;
    this.#rotation = rotation;
    this.#flexibility = flexibility;
    this.#stepReaction = stepReaction;
    this.#phase = phase;
    this.#entity = new pc.Entity(`Ground cover ${variant}`);
    this.#entity.setLocalPosition(x, y, z);

    this.#model = modelLibrary.instantiateMerged(modelUrl);
    this.#model.setLocalEulerAngles(0, rotation, 0);
    this.#model.setLocalScale(scale, scale, scale);
    this.#entity.addChild(this.#model);
    this.ambientMotion = ambientMotion;
  }

  get entity() {
    return this.#entity;
  }

  get position() {
    return this.#position;
  }

  get grassImpressionContacts() {
    return this.#debris?.grassImpressionContacts ?? [];
  }

  set ambientMotion(value) {
    this.#ambientMotion = Math.max(0, Math.min(1, value));
    this.advance(0);
  }

  applyWind(directionX, directionZ, strength) {
    if (!this.#entity.enabled) {
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
      this.#entity.enabled = false;
      return;
    }
    if (this.#stepReaction !== "recover") {
      return;
    }

    const directionLength = Math.hypot(directionX, directionZ) || 1;
    this.#trampleTiltX = (directionZ / directionLength) * FLOWER_TRAMPLE_ANGLE;
    this.#trampleTiltZ = (-directionX / directionLength) * FLOWER_TRAMPLE_ANGLE;
    this.#trampleAmount = 1;
    this.#trampleHold = FLOWER_TRAMPLE_HOLD;
  }

  collect() {
    if (!this.#entity.enabled) {
      return;
    }
    this.#entity.enabled = false;
  }

  crush({ directionX = 0, directionZ = 1 } = {}) {
    if (!this.#entity.enabled || this.#destroyed) {
      return;
    }
    const directionLength = Math.hypot(directionX, directionZ) || 1;
    this.#crushDirectionX = directionX / directionLength;
    this.#crushDirectionZ = directionZ / directionLength;
    this.#destroyed = true;
  }

  #createDebris() {
    const debris = new MushroomDebris({
      pc: this.#pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      modelUrl: this.#modelUrl,
      variant: this.#variant,
      scale: this.#scale,
      rotation: this.#rotation,
      seed: Math.round(this.#phase * 1_000_000),
    });
    this.#entity.addChild(debris.entity);
    if (
      !debris.burst({
        directionX: this.#crushDirectionX,
        directionZ: this.#crushDirectionZ,
      })
    ) {
      debris.destroy();
      this.#entity.enabled = false;
      return;
    }
    this.#debris = debris;
    this.#model.enabled = false;
    this.#entity.setLocalEulerAngles(0, 0, 0);
    this.#entity.setLocalScale(1, 1, 1);
  }

  advance(deltaTime) {
    if (!this.#entity.enabled) {
      return;
    }
    if (this.#destroyed) {
      this.#advanceDestruction(deltaTime);
      return;
    }
    this.#elapsed += deltaTime;
    const decay = Math.exp(-deltaTime * WIND_DECAY);
    this.#targetTiltX *= decay;
    this.#targetTiltZ *= decay;
    const response = 1 - Math.exp(-deltaTime * WIND_RESPONSE);
    this.#tiltX += (this.#targetTiltX - this.#tiltX) * response;
    this.#tiltZ += (this.#targetTiltZ - this.#tiltZ) * response;

    const ambient = this.#flexibility * 0.45 * this.#ambientMotion;
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

  destroy() {
    this.#debris?.destroy();
    this.#debris = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#model = null;
  }

  #advanceDestruction(deltaTime) {
    if (!this.#debris) {
      this.#crushElapsed = Math.min(
        MUSHROOM_CRUSH_TIME,
        this.#crushElapsed + Math.min(deltaTime, 0.1),
      );
      const progress = this.#crushElapsed / MUSHROOM_CRUSH_TIME;
      const easedProgress = progress * progress * (3 - 2 * progress);
      this.#entity.setLocalEulerAngles(
        this.#crushDirectionZ * MUSHROOM_CRUSH_TILT * easedProgress,
        0,
        -this.#crushDirectionX * MUSHROOM_CRUSH_TILT * easedProgress,
      );
      const spread = 1 + MUSHROOM_CRUSH_SPREAD * easedProgress;
      this.#entity.setLocalScale(
        spread,
        1 - MUSHROOM_CRUSH_COMPRESSION * easedProgress,
        spread,
      );
      if (progress >= 1) {
        this.#createDebris();
      }
      return;
    }
    this.#debris.advance(deltaTime);
    if (this.#debris.expired) {
      this.#debris.destroy();
      this.#debris = null;
      this.#entity.enabled = false;
    }
  }
}
