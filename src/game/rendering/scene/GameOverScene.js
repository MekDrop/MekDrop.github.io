import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";
import { GameOverHud } from "../../ui/index.js";

const FALLBACK_ZOOM = 1.75;
const CAMERA_DURATION = 0.8;
const ROYAL_VIEWPORT_HEIGHT = 0.6;

export class GameOverScene {
  #hud = null;
  #sceneObjects;
  #getViewport;
  #getCameraPosition;
  #getCameraState;
  #setCameraState;
  #clearCameraReturn;
  #updateCamera;
  #cameraPitch;
  #mapFitZoom;
  #transition = null;
  #returnViewport = null;
  #active = false;

  constructor({
    pc,
    app,
    translate,
    theme,
    sceneObjects,
    getViewport,
    getCameraPosition,
    getCameraState,
    setCameraState,
    clearCameraReturn,
    updateCamera,
    cameraPitch,
    mapFitZoom,
  }) {
    this.#sceneObjects = sceneObjects;
    this.#getViewport = getViewport;
    this.#getCameraPosition = getCameraPosition;
    this.#getCameraState = getCameraState;
    this.#setCameraState = setCameraState;
    this.#clearCameraReturn = clearCameraReturn;
    this.#updateCamera = updateCamera;
    this.#cameraPitch = cameraPitch;
    this.#mapFitZoom = mapFitZoom;
    this.#hud = new GameOverHud({
      pc,
      app,
      translate,
      theme,
    });
    this.#hud.attach();
  }

  get isActive() {
    return this.#active;
  }

  get cameraLocked() {
    return this.#active;
  }

  get returnViewport() {
    return this.#returnViewport
      ? { ...this.#returnViewport }
      : this.#getViewport();
  }

  reset() {
    this.#returnViewport = null;
    this.#transition = null;
    this.#active = false;
    if (this.#hud) {
      this.#hud.visible = false;
    }
  }

  syncHeroState(state) {
    if (this.#hud) {
      this.#hud.visible = state.gameOver;
    }
    if (!state.gameOver || this.#active) {
      return;
    }
    const castle = this.#sceneObjects.getFirst(SCENE_OBJECT_TYPE.CASTLE);
    if (!castle || !this.#getCameraPosition()) {
      return;
    }
    const presentation = castle.beginGameOver(() =>
      this.#getCameraPosition(),
    );
    if (!presentation) {
      return;
    }
    this.#returnViewport = this.#getViewport();
    this.#active = true;
    this.#clearCameraReturn();
    const cameraState = this.#getCameraState();
    const { focus, visualSize, viewRotation } = presentation;
    const rotationDelta =
      ((((viewRotation - cameraState.rotation + 2) % 4) + 4) % 4) - 2;
    this.#transition = {
      elapsed: 0,
      startRotation: cameraState.rotation,
      rotationDelta,
      startPanX: cameraState.panX,
      startPanZ: cameraState.panZ,
      endPanX: focus.x,
      endPanZ: focus.z,
      startTargetY: cameraState.targetY,
      endTargetY: focus.y,
      startZoom: cameraState.zoom,
      endZoom: this.#getZoom(visualSize, viewRotation, cameraState),
    };
    this.#setCameraState({ viewportManuallyMoved: true });
    castle.startGameOverPerformance();
  }

  update(deltaTime) {
    const transition = this.#transition;
    if (!transition) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(1, transition.elapsed / CAMERA_DURATION);
    const easedProgress = progress * progress * (3 - 2 * progress);
    this.#setCameraState({
      rotation:
        transition.startRotation +
        transition.rotationDelta * easedProgress,
      panX:
        transition.startPanX +
        (transition.endPanX - transition.startPanX) * easedProgress,
      panZ:
        transition.startPanZ +
        (transition.endPanZ - transition.startPanZ) * easedProgress,
      targetY:
        transition.startTargetY +
        (transition.endTargetY - transition.startTargetY) * easedProgress,
      zoom:
        transition.startZoom +
        (transition.endZoom - transition.startZoom) * easedProgress,
    });
    this.#updateCamera();
    if (progress < 1) {
      return;
    }
    this.#setCameraState({
      rotation: ((this.#getCameraState().rotation % 4) + 4) % 4,
    });
    this.#transition = null;
    this.#updateCamera();
  }

  destroy() {
    this.#hud?.destroy();
    this.#hud = null;
    this.#sceneObjects = null;
    this.#transition = null;
    this.#returnViewport = null;
  }

  #getZoom(visualSize, viewRotation, cameraState) {
    if (
      !visualSize ||
      !Number.isFinite(visualSize.x) ||
      !Number.isFinite(visualSize.y) ||
      !Number.isFinite(visualSize.z)
    ) {
      return FALLBACK_ZOOM;
    }
    const yaw = Math.PI / 4 + viewRotation * (Math.PI / 2);
    const horizontalDepth =
      Math.abs(Math.sin(yaw)) * visualSize.x +
      Math.abs(Math.cos(yaw)) * visualSize.z;
    const projectedHeight =
      visualSize.y * Math.cos(this.#cameraPitch) +
      horizontalDepth * Math.sin(this.#cameraPitch);
    if (projectedHeight <= 0.001) {
      return FALLBACK_ZOOM;
    }
    return Math.max(
      this.#mapFitZoom,
      (2 * cameraState.baseOrthoHeight * ROYAL_VIEWPORT_HEIGHT) /
        projectedHeight,
    );
  }
}
