import { AbstractCameraMode } from "./AbstractCameraMode.js";
import { CameraPanBounds } from "../../camera/CameraPanBounds.js";

export class IsometricCameraMode extends AbstractCameraMode {
  /**
   *
   * @type {boolean}
   */
  #panLimitsEnabled = true;
  /**
   *
   * @type {CameraPanBounds|null}
   */
  #panBounds = null;

  /**
   *
   * @param {GameCamera} gameCamera
   * @param {{mapData: import("src/game/GameContracts.js").GameMapData}} options
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   */
  constructor(gameCamera, { mapData } = {}) {
    super(gameCamera);
    if (mapData) {
      /**
       *
       * @type {CameraPanBounds}
       */
      this.#panBounds = new CameraPanBounds(mapData);
    }
  }

  get panLimitsEnabled() {
    return this.#panLimitsEnabled;
  }

  set panLimitsEnabled(value) {
    this.#panLimitsEnabled = Boolean(value);
  }

  get panBounds() {
    return this.#panBounds;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  reset(mapData) {
    this.#panBounds = new CameraPanBounds(mapData);
  }

  enter() {
    const { gameCamera } = this;
    gameCamera.component.projection = gameCamera.playCanvas.PROJECTION_ORTHOGRAPHIC;
  }

  /**
   *
   * @param {{cameraDistance: number, cameraPitch: number}} options
   * @param {number} options.cameraDistance
   * @param {number} options.cameraPitch
   */
  update({ cameraDistance, cameraPitch }) {
    const { gameCamera } = this;
    const yaw = Math.PI / 4 + gameCamera.rotation * (Math.PI / 2);
    const horizontalDistance = cameraDistance * Math.cos(cameraPitch);
    const target = new gameCamera.playCanvas.Vec3(
      gameCamera.panX,
      gameCamera.targetY,
      gameCamera.panZ,
    );
    gameCamera.entity.setPosition(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + Math.sin(cameraPitch) * cameraDistance,
      target.z + Math.cos(yaw) * horizontalDistance,
    );
    gameCamera.entity.lookAt(target);
    gameCamera.component.orthoHeight = gameCamera.baseOrthoHeight / gameCamera.zoom;
    return { free: false, position: gameCamera.entity.getPosition() };
  }
}
