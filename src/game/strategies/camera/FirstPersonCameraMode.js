import { AbstractCameraMode } from "./AbstractCameraMode.js";

const FIELD_OF_VIEW = 70;
const NEAR_CLIP = 0.01;
const MAXIMUM_DOWNWARD_PITCH = 80;
const MAXIMUM_UPWARD_PITCH = 60;
const MAXIMUM_YAW = 80;

/**
 *
 * @param {number} degrees
 */
function normalizeDegrees(degrees) {
  return ((degrees + 540) % 360) - 180;
}

export class FirstPersonCameraMode extends AbstractCameraMode {
  /**
   *
   * @type {null}
   */
  #position = null;
  /**
   *
   * @type {null}
   */
  #direction = null;
  /**
   *
   * @type {null}
   */
  #right = null;
  /**
   *
   * @type {null}
   */
  #yaw = null;
  /**
   *
   * @type {null}
   */
  #centerYaw = null;
  /**
   *
   * @type {number}
   */
  #pitch = 0;

  /**
   * @type {number|null}
   */
  #previousNearClip = null;

  /**
   *
   * @returns {boolean}
   */
  get pointerInputActive() {
    return true;
  }

  /**
   *
   * @param {{button: number, captured: boolean}} options
   * @param {number} options.button
   * @param {boolean} options.captured
   */
  pointerDown({ button, captured }) {
    if (button !== 0) {
      return null;
    }
    return {
      capture: !captured,
      primary: captured,
    };
  }

  /**
   *
   * @param {{captured: boolean, movementX: number, movementY: number, degreesPerPixel: number}} options
   * @param {boolean} options.captured
   * @param {number} options.movementX
   * @param {number} options.movementY
   * @param {number} options.degreesPerPixel
   */
  pointerMove({ captured, movementX, movementY, degreesPerPixel }) {
    if (!captured) {
      return false;
    }
    this.lookBy(
      -movementX * degreesPerPixel,
      movementY * degreesPerPixel,
    );
    return true;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraState}
   */
  get state() {
    if (!this.#position || !this.#direction) {
      return null;
    }
    return {
      position: {
        x: this.#position.x,
        y: this.#position.y,
        z: this.#position.z,
      },
      direction: { ...this.#direction },
      right: { ...this.#right },
      perspective:
        this.gameCamera.component.projection ===
        this.gameCamera.playCanvas.PROJECTION_PERSPECTIVE,
    };
  }

  enter() {
    const { gameCamera } = this;
    this.#previousNearClip = gameCamera.component.nearClip;
    // A 10 cm near plane cuts through nearby 25 cm castle blocks at eye level.
    gameCamera.component.nearClip = NEAR_CLIP;
    gameCamera.component.projection = gameCamera.playCanvas.PROJECTION_PERSPECTIVE;
    gameCamera.component.fov = FIELD_OF_VIEW;
  }

  exit() {
    if (this.#previousNearClip !== null) {
      this.gameCamera.component.nearClip = this.#previousNearClip;
      this.#previousNearClip = null;
    }
    this.#position = null;
    this.#direction = null;
    this.#right = null;
    this.#yaw = null;
    this.#centerYaw = null;
    this.#pitch = 0;
  }

  /**
   *
   * @param {number} yawDegrees
   * @param {number} pitchDegrees
   */
  lookBy(yawDegrees, pitchDegrees) {
    if (!Number.isFinite(yawDegrees) || !Number.isFinite(pitchDegrees)) {
      return;
    }
    const centerYaw = this.#centerYaw ?? this.#yaw ?? 0;
    const nextYaw = (this.#yaw ?? centerYaw) + yawDegrees;
    this.#yaw =
      centerYaw +
      Math.max(
        -MAXIMUM_YAW,
        Math.min(MAXIMUM_YAW, normalizeDegrees(nextYaw - centerYaw)),
      );
    this.#pitch = Math.max(
      -MAXIMUM_DOWNWARD_PITCH,
      Math.min(MAXIMUM_UPWARD_PITCH, this.#pitch - pitchDegrees),
    );
  }

  /**
   *
   * @param {{hero: {entity: pc.Entity, position?: pc.Vec3, visible?: boolean}}} options
   * @param {{entity: pc.Entity, position?: pc.Vec3, visible?: boolean}} options.hero
   */
  update({ hero }) {
    const pose = hero?.firstPersonCameraPose;
    if (!pose) {
      return { firstPerson: true, position: null };
    }
    const { gameCamera } = this;
    this.#position = new gameCamera.playCanvas.Vec3(
      pose.position.x,
      pose.position.y,
      pose.position.z,
    );
    const centerYaw =
      (Math.atan2(pose.direction.x, pose.direction.z) * 180) / Math.PI;
    this.#centerYaw = centerYaw;
    this.#yaw ??= centerYaw;
    this.#yaw =
      centerYaw +
      Math.max(
        -MAXIMUM_YAW,
        Math.min(MAXIMUM_YAW, normalizeDegrees(this.#yaw - centerYaw)),
      );
    const yaw = (this.#yaw * Math.PI) / 180;
    const pitch = (this.#pitch * Math.PI) / 180;
    const horizontal = Math.cos(pitch);
    this.#direction = {
      x: Math.sin(yaw) * horizontal,
      y: Math.sin(pitch),
      z: Math.cos(yaw) * horizontal,
    };
    gameCamera.entity.setPosition(this.#position);
    gameCamera.entity.lookAt(
      this.#position.x + this.#direction.x,
      this.#position.y + this.#direction.y,
      this.#position.z + this.#direction.z,
    );
    this.#right = {
      x: gameCamera.right.x,
      y: gameCamera.right.y,
      z: gameCamera.right.z,
    };
    return { firstPerson: true, position: this.#position };
  }
}
