import { AbstractCameraMode } from "./AbstractCameraMode.js";

const FIELD_OF_VIEW = 70;
const MAXIMUM_PITCH = 85;

export class FirstPersonCameraMode extends AbstractCameraMode {
  #position = null;
  #direction = null;
  #yaw = null;
  #pitch = 0;

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
    this.#yaw = null;
    this.#pitch = 0;
  }

  lookBy(yawDegrees, pitchDegrees) {
    if (!Number.isFinite(yawDegrees) || !Number.isFinite(pitchDegrees)) {
      return;
    }
    this.#yaw = (this.#yaw ?? 0) + yawDegrees;
    this.#pitch = Math.max(
      -MAXIMUM_PITCH,
      Math.min(MAXIMUM_PITCH, this.#pitch - pitchDegrees),
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
    if (this.#yaw === null) {
      this.#yaw =
        (Math.atan2(pose.direction.x, pose.direction.z) * 180) / Math.PI;
    }
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
    return { firstPerson: true, position: this.#position };
  }
}
