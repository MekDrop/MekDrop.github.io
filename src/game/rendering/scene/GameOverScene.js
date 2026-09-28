import { SCENE_OBJECT_TYPE } from "../../enum/SceneObjectType.js";
import { GameOverHud } from "../../ui/index.js";

const FALLBACK_ZOOM = 1.75;
const CAMERA_DURATION = 0.8;
const ROYAL_VIEWPORT_HEIGHT = 0.6;

export class GameOverScene {
  /**
   *
   * @type {GameOverHud|null}
   */
  #hud = null;
  /**
   *
   * @type {Array}
   */
  #sceneObjects;
  /**
   *
   * @type {() => import("src/game/GameContracts.js").ViewportRect}
   */
  #getViewport;
  /**
   *
   * @type {() => pc.Vec3}
   */
  #getCameraPosition;
  /**
   *
   * @type {() => import("src/game/GameContracts.js").CameraState}
   */
  #getCameraState;
  /**
   *
   * @type {(state: import("src/game/GameContracts.js").CameraState) => void}
   */
  #setCameraState;
  /**
   *
   * @type {() => void}
   */
  #clearCameraReturn;
  /**
   *
   * @type {() => void}
   */
  #updateCamera;
  /**
   *
   * @type {number}
   */
  #cameraPitch;
  /**
   *
   * @type {number}
   */
  #mapFitZoom;
  /**
   *
   * @type {null}
   */
  #transition = null;
  /**
   *
   * @type {null}
   */
  #returnViewport = null;
  /**
   *
   * @type {boolean}
   */
  #active = false;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, translate: (key: string, values?: {[key: string]: string|number}) => string, sceneObjects: Array, getViewport: () => import("src/game/GameContracts.js").ViewportRect, getCameraPosition: () => pc.Vec3, getCameraState: () => import("src/game/GameContracts.js").CameraState, setCameraState: (state: import("src/game/GameContracts.js").CameraState) => void, clearCameraReturn: () => void, updateCamera: () => void, cameraPitch: number, mapFitZoom: number}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {(key: string, values?: {[key: string]: string|number}) => string} options.translate
   * @param {Array} options.sceneObjects
   * @param {() => import("src/game/GameContracts.js").ViewportRect} options.getViewport
   * @param {() => pc.Vec3} options.getCameraPosition
   * @param {() => import("src/game/GameContracts.js").CameraState} options.getCameraState
   * @param {(state: import("src/game/GameContracts.js").CameraState) => void} options.setCameraState
   * @param {() => void} options.clearCameraReturn
   * @param {() => void} options.updateCamera
   * @param {number} options.cameraPitch
   * @param {number} options.mapFitZoom
   */
  constructor({
    pc,
    app,
    translate,
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
    /**
     *
     * @type {Array}
     */
    this.#sceneObjects = sceneObjects;
    /**
     *
     * @type {() => import("src/game/GameContracts.js").ViewportRect}
     */
    this.#getViewport = getViewport;
    /**
     *
     * @type {() => pc.Vec3}
     */
    this.#getCameraPosition = getCameraPosition;
    /**
     *
     * @type {() => import("src/game/GameContracts.js").CameraState}
     */
    this.#getCameraState = getCameraState;
    /**
     *
     * @type {(state: import("src/game/GameContracts.js").CameraState) => void}
     */
    this.#setCameraState = setCameraState;
    /**
     *
     * @type {() => void}
     */
    this.#clearCameraReturn = clearCameraReturn;
    /**
     *
     * @type {() => void}
     */
    this.#updateCamera = updateCamera;
    /**
     *
     * @type {number}
     */
    this.#cameraPitch = cameraPitch;
    /**
     *
     * @type {number}
     */
    this.#mapFitZoom = mapFitZoom;
    /**
     *
     * @type {GameOverHud}
     */
    this.#hud = new GameOverHud({
      pc,
      app,
      translate,
    });
    this.#hud.attach();
  }

  get isActive() {
    return this.#active;
  }

  get cameraLocked() {
    return this.#active;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").ViewportRect}
   */
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

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  syncHeroState(state) {
    if (this.#hud) {
      this.#hud.visible = state.gameOver;
    }
    if (!state.gameOver || this.#active) {
      return;
    }
    const royals = this.#sceneObjects
      .getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
      .filter(/**
       *
       * @param {import("src/game/GameContracts.js").GameObjectContract} object
       */
      (object) => typeof object.beginGameOver === "function");
    if (royals.length === 0 || !this.#getCameraPosition()) {
      return;
    }
    const performances = royals
      .map(/**
       *
       * @param {{entity: pc.Entity, definition?: GameObjectDefinition}} royal
       */
      (royal) => ({
        royal,
        presentation: royal.beginGameOver(() => this.#getCameraPosition()),
      }))
      .filter(/**
       *
       * @param {{presentation: {install?: () => void, destroy?: () => void}}} options
       * @param {{install?: () => void, destroy?: () => void}} options.presentation
       */
      ({ presentation }) => presentation);
    if (performances.length === 0) {
      return;
    }
    this.#returnViewport = this.#getViewport();
    this.#active = true;
    this.#clearCameraReturn();
    const cameraState = this.#getCameraState();
    const { focus, visualSize, viewRotation } = performances[0].presentation;
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
    for (const { royal } of performances) {
      royal.startGameOverPerformance();
    }
  }

  /**
   *
   * @param {number} deltaTime
   */
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
        transition.startRotation + transition.rotationDelta * easedProgress,
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

  /**
   *
   * @param {{x: number, y: number, z: number}} visualSize
   * @param {number} viewRotation
   * @param {import("src/game/GameContracts.js").CameraState} cameraState
   */
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
