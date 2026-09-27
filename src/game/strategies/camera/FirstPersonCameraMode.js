import { AbstractCameraMode } from "./AbstractCameraMode.js";

const FIELD_OF_VIEW = 70;
const MAXIMUM_DOWNWARD_PITCH = 80;
const MAXIMUM_UPWARD_PITCH = 60;
const MAXIMUM_YAW = 80;

function normalizeDegrees(degrees) {
  return ((degrees + 540) % 360) - 180;
}

export class FirstPersonCameraMode extends AbstractCameraMode {
  #position = null;
  #direction = null;
  #right = null;
  #yaw = null;
  #centerYaw = null;
  #pitch = 0;

  get pointerInputActive() {
    return true;
  }

  pointerDown({ button, captured }) {
    if (button !== 0) {
      return null;
    }
    return {
      capture: !captured,
      primary: captured,
    };
  }

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
    gameCamera.component.projection = gameCamera.playCanvas.PROJECTION_PERSPECTIVE;
    gameCamera.component.fov = FIELD_OF_VIEW;
  }

  exit() {
    this.#position = null;
    this.#direction = null;
    this.#right = null;
    this.#yaw = null;
    this.#centerYaw = null;
    this.#pitch = 0;
  }

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
