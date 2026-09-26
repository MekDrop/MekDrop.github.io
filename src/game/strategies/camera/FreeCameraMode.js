import { AbstractCameraMode } from "./AbstractCameraMode.js";

const FIELD_OF_VIEW = 60;
const MOVE_PER_PIXEL = 0.035;
const VERTICAL_STEP = 0.8;
const SWEEP_STEP = 0.08;
const MINIMUM_PITCH = -85;
const MAXIMUM_PITCH = 85;

export class FreeCameraMode extends AbstractCameraMode {
  #position = null;
  #euler = null;
  #isPositionBlocked;

  constructor(gameCamera, { isPositionBlocked }) {
    super(gameCamera);
    this.#isPositionBlocked = isPositionBlocked;
  }

  get state() {
    if (!this.#position) {
      return null;
    }
    return {
      position: {
        x: this.#position.x,
        y: this.#position.y,
        z: this.#position.z,
      },
      perspective:
        this.gameCamera.component.projection ===
        this.gameCamera.playCanvas.PROJECTION_PERSPECTIVE,
    };
  }

  enter({ cameraPitch }) {
    const { gameCamera } = this;
    const yaw = Math.PI / 4 + gameCamera.rotation * (Math.PI / 2);
    const forward = new gameCamera.playCanvas.Vec3(
      -Math.sin(yaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch),
      -Math.cos(yaw) * Math.cos(cameraPitch),
    );
    const target = new gameCamera.playCanvas.Vec3(
      gameCamera.panX,
      gameCamera.targetY,
      gameCamera.panZ,
    );
    const visibleHeight = gameCamera.baseOrthoHeight / Math.max(1, gameCamera.zoom);
    const perspectiveDistance = Math.max(
      4,
      Math.min(
        24,
        visibleHeight / (2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)),
      ),
    );
    this.#position = target.clone().sub(
      forward.clone().mulScalar(perspectiveDistance),
    );
    this.#euler = new gameCamera.playCanvas.Vec3(
      -cameraPitch * (180 / Math.PI),
      45 + gameCamera.rotation * 90,
      0,
    );
    gameCamera.component.projection = gameCamera.playCanvas.PROJECTION_PERSPECTIVE;
    gameCamera.component.fov = FIELD_OF_VIEW;
  }

  exit() {
    this.#position = null;
    this.#euler = null;
  }

  panBy(deltaX, deltaY) {
    if (!this.#position || !this.#euler) {
      return;
    }
    const yaw = this.#euler.y * (Math.PI / 180);
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    this.#moveBy(
      (forwardX * deltaY - rightX * deltaX) * MOVE_PER_PIXEL,
      0,
      (forwardZ * deltaY - rightZ * deltaX) * MOVE_PER_PIXEL,
    );
  }

  moveVertically(direction) {
    if (!Number.isFinite(direction)) {
      return;
    }
    this.#moveBy(0, direction * VERTICAL_STEP, 0);
  }

  rotateBy(horizontalQuarterTurns, verticalQuarterTurns) {
    if (!this.#euler) {
      return;
    }
    this.#euler.y += horizontalQuarterTurns * 90;
    this.#euler.x = Math.max(
      MINIMUM_PITCH,
      Math.min(
        MAXIMUM_PITCH,
        this.#euler.x + verticalQuarterTurns * 90,
      ),
    );
    this.gameCamera.manuallyMoved = true;
  }

  update() {
    if (!this.#position || !this.#euler) {
      return { free: true, position: null };
    }
    const { entity } = this.gameCamera;
    entity.setPosition(this.#position);
    entity.setEulerAngles(this.#euler);
    return { free: true, position: this.#position };
  }

  #moveBy(deltaX, deltaY, deltaZ) {
    if (!this.#position) {
      return;
    }
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const steps = Math.max(1, Math.ceil(distance / SWEEP_STEP));
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;
    const stepZ = deltaZ / steps;
    for (let step = 0; step < steps; step += 1) {
      const candidate = new this.gameCamera.playCanvas.Vec3(
        this.#position.x + stepX,
        this.#position.y + stepY,
        this.#position.z + stepZ,
      );
      if (!this.#isPositionBlocked(candidate)) {
        this.#position.copy(candidate);
        continue;
      }
      if (stepY !== 0) {
        break;
      }
      const candidateX = new this.gameCamera.playCanvas.Vec3(
        this.#position.x + stepX,
        this.#position.y,
        this.#position.z,
      );
      if (!this.#isPositionBlocked(candidateX)) {
        this.#position.copy(candidateX);
      }
      const candidateZ = new this.gameCamera.playCanvas.Vec3(
        this.#position.x,
        this.#position.y,
        this.#position.z + stepZ,
      );
      if (!this.#isPositionBlocked(candidateZ)) {
        this.#position.copy(candidateZ);
      }
    }
    this.gameCamera.panX = this.#position.x;
    this.gameCamera.panZ = this.#position.z;
    this.gameCamera.manuallyMoved = true;
  }
}
