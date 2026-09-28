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

/**
 *
 * @param {number} scale
 */
function normalizedScale(scale) {
  if (typeof scale === "number") {
    return { x: scale, y: scale, z: scale };
  }
  return scale;
}

export class GroundCoverItem {
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Application}
   */
  #app;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {string}
   */
  #model;
  /**
   *
    * @type {string}
   */
  #modelLibrary;
  /**
   *
    * @type {string}
   */
  #modelUrl;
  /**
   *
    * @type {string}
   */
  #variant;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {number}
   */
  #scale;
  /**
   *
    * @type {number}
   */
  #rotation;
  /**
   *
    * @type {number}
   */
  #flexibility;
  /**
   *
    * @type {number}
   */
  #stepReaction;
  /**
   *
    * @type {number}
   */
  #phase;
  /**
   *
    * @type {number}
   */
  #elapsed = 0;
  /**
   *
    * @type {number}
   */
  #targetTiltX = 0;
  /**
   *
    * @type {number}
   */
  #targetTiltZ = 0;
  /**
   *
    * @type {number}
   */
  #tiltX = 0;
  /**
   *
    * @type {number}
   */
  #tiltZ = 0;
  /**
   *
    * @type {number}
   */
  #trampleAmount = 0;
  /**
   *
    * @type {number}
   */
  #trampleHold = 0;
  /**
   *
    * @type {number}
   */
  #trampleTiltX = 0;
  /**
   *
    * @type {number}
   */
  #trampleTiltZ = 0;
  /**
   *
    * @type {number}
   */
  #ambientMotion = 1;
  /**
   *
    * @type {boolean}
   */
  #destroyed = false;
  /**
   *
    * @type {MushroomDebris|null}
   */
  #debris = null;
  /**
   *
    * @type {number}
   */
  #crushElapsed = 0;
  /**
   *
    * @type {number}
   */
  #crushDirectionX = 0;
  /**
   *
    * @type {number}
   */
  #crushDirectionZ = 1;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: string, modelUrl: string, variant: string, x: number, y: number, z: number, rotation: number, scale: number, flexibility: number, stepReaction: number, phase: number, ambientMotion: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {string} options.modelLibrary
   * @param {string} options.modelUrl
   * @param {string} options.variant
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} options.rotation
   * @param {number} options.scale
   * @param {number} options.flexibility
   * @param {number} options.stepReaction
   * @param {number} options.phase
   * @param {number} options.ambientMotion
   */
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
    const modelScale = normalizedScale(scale);
    this.#model.setLocalScale(modelScale.x, modelScale.y, modelScale.z);
    this.#entity.addChild(this.#model);

    this.ambientMotion = ambientMotion;
  }

  get entity() {
    return this.#entity;
  }

  get position() {
    return this.#position;
  }

  /**
   *
    * @returns {Array<{id: import("playcanvas").Entity, x: number, y: number, z: number, radius: number, strength: number}>}
   */
  get grassImpressionContacts() {
    return this.#debris?.grassImpressionContacts ?? [];
  }

  set ambientMotion(value) {
    this.#ambientMotion = Math.max(0, Math.min(1, value));
    this.advance(0);
  }

  /**
   *
   * @param {number} directionX
   * @param {number} directionZ
   * @param {number} strength
   */
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

  /**
   *
   * @param {number} directionX
   * @param {number} directionZ
   */
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

  /**
   *
   * @param {{directionX: number, directionZ: number}} options
   * @param {number} options.directionX
   * @param {number} options.directionZ
   */
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

  /**
   *
   * @param {number} deltaTime
   */
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

  /**
   *
   * @param {number} deltaTime
   */
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
