import { FirstPersonCameraMode } from "../strategies/camera/FirstPersonCameraMode.js";
import { IsometricCameraMode } from "../strategies/camera/IsometricCameraMode.js";

export class GameCamera {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Entity}
   */
  #entity;
  /**
   *
   * @type {IsometricCameraMode}
   */
  #mode;
  /**
   *
   * @type {number}
   */
  #zoom = 1;
  /**
   *
   * @type {number}
   */
  #rotation = 0;
  /**
   *
   * @type {number}
   */
  #panX = 0;
  /**
   *
   * @type {number}
   */
  #panZ = 0;
  /**
   *
   * @type {number}
   */
  #targetY;
  /**
   *
   * @type {number}
   */
  #baseOrthoHeight = 24;
  /**
   *
   * @type {number}
   */
  #fitCenterX = 0;
  /**
   *
   * @type {number}
   */
  #fitCenterZ = 0;
  /**
   *
   * @type {boolean}
   */
  #manuallyMoved = false;
  /**
   *
   * @type {null}
   */
  #orbitPivot = null;
  /**
   *
   * @type {null}
   */
  #returnTransition = null;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, cloudLayerId: string, targetY: number}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {string} options.cloudLayerId
   * @param {number} options.targetY
   */
  constructor({ pc, app, cloudLayerId, targetY }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {number}
     */
    this.#targetY = targetY;
    /**
     *
     * @type {pc.Entity}
     */
    this.#entity = new pc.Entity("Game camera");
    this.#entity.addComponent("camera", {
      clearColor: new pc.Color(0.055, 0.45, 0.72),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      nearClip: 0.1,
      farClip: 250,
    });
    this.#entity.camera.layers = [cloudLayerId, ...this.#entity.camera.layers];
    app.root.addChild(this.#entity);
    /**
     *
     * @type {IsometricCameraMode}
     */
    this.#mode = new IsometricCameraMode(this);
  }

  get playCanvas() {
    return this.#pc;
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @returns {pc.Entity}
   */
  get camera() {
    return this.#entity.camera;
  }

  /**
   *
   * @returns {pc.Entity}
   */
  get component() {
    return this.#entity.camera;
  }

  /**
   *
   * @returns {number}
   */
  get right() {
    return this.#entity.right;
  }

  get zoom() {
    return this.#zoom;
  }

  set zoom(value) {
    this.#zoom = value;
  }

  get rotation() {
    return this.#rotation;
  }

  set rotation(value) {
    this.#rotation = value;
  }

  get panX() {
    return this.#panX;
  }

  set panX(value) {
    this.#panX = value;
  }

  get panZ() {
    return this.#panZ;
  }

  set panZ(value) {
    this.#panZ = value;
  }

  get targetY() {
    return this.#targetY;
  }

  set targetY(value) {
    this.#targetY = value;
  }

  get baseOrthoHeight() {
    return this.#baseOrthoHeight;
  }

  set baseOrthoHeight(value) {
    this.#baseOrthoHeight = value;
  }

  get fitCenterX() {
    return this.#fitCenterX;
  }

  set fitCenterX(value) {
    this.#fitCenterX = value;
  }

  get fitCenterZ() {
    return this.#fitCenterZ;
  }

  set fitCenterZ(value) {
    this.#fitCenterZ = value;
  }

  get manuallyMoved() {
    return this.#manuallyMoved;
  }

  set manuallyMoved(value) {
    this.#manuallyMoved = Boolean(value);
  }

  /**
   *
   * @returns {boolean}
   */
  get panLimitsEnabled() {
    return this.#mode.panLimitsEnabled ?? false;
  }

  set panLimitsEnabled(value) {
    if ("panLimitsEnabled" in this.#mode) {
      this.#mode.panLimitsEnabled = value;
    }
  }

  /**
   *
   * @returns {Array|null}
   */
  get panBounds() {
    return this.#mode.panBounds ?? null;
  }

  get orbitPivot() {
    return this.#orbitPivot;
  }

  set orbitPivot(value) {
    this.#orbitPivot = value;
  }

  get returnTransition() {
    return this.#returnTransition;
  }

  set returnTransition(value) {
    this.#returnTransition = value;
  }

  /**
   *
   * @returns {boolean}
   */
  get firstPersonEnabled() {
    return this.#mode instanceof FirstPersonCameraMode;
  }

  /**
   *
   * @returns {string|null}
   */
  get firstPersonState() {
    return this.firstPersonEnabled ? this.#mode.state : null;
  }

  /**
   *
   * @returns {number}
   */
  get pointerInputActive() {
    return this.#mode.pointerInputActive;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").ViewportRect}
   */
  get viewport() {
    return {
      zoom: this.#zoom,
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      manuallyMoved: this.#manuallyMoved,
    };
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraState}
   */
  get state() {
    return {
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      targetY: this.#targetY,
      zoom: this.#zoom,
      baseOrthoHeight: this.#baseOrthoHeight,
    };
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   * @param {number} targetY
   */
  reset(mapData, targetY) {
    this.#mode.reset?.(mapData);
    this.#zoom = 1;
    this.#rotation = 0;
    this.#panX = 0;
    this.#panZ = 0;
    this.#targetY = targetY;
    this.#manuallyMoved = false;
    this.#returnTransition = null;
    this.#orbitPivot = null;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  setState(state) {
    if (Number.isFinite(state.rotation)) {
      this.#rotation = state.rotation;
    }
    if (Number.isFinite(state.panX)) {
      this.#panX = state.panX;
    }
    if (Number.isFinite(state.panZ)) {
      this.#panZ = state.panZ;
    }
    if (Number.isFinite(state.targetY)) {
      this.#targetY = state.targetY;
    }
    if (Number.isFinite(state.zoom)) {
      this.#zoom = state.zoom;
    }
    if (Object.hasOwn(state, "viewportManuallyMoved")) {
      this.#manuallyMoved = Boolean(state.viewportManuallyMoved);
    }
  }

  /**
   *
   * @param {boolean} enabled
   * @param {{mapData: import("src/game/GameContracts.js").GameMapData}} options
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   */
  setFirstPersonEnabled(enabled, { mapData }) {
    const nextEnabled = Boolean(enabled);
    if (this.firstPersonEnabled === nextEnabled) {
      return false;
    }
    this.#mode.exit();
    this.#mode = nextEnabled
      ? new FirstPersonCameraMode(this)
      : new IsometricCameraMode(this, { mapData });
    this.#mode.enter();
    return true;
  }

  /**
   *
   * @param {{mapName?: string, numPaths?: number, numRivers?: number, signal?: AbortSignal}} options
   */
  update(options) {
    return this.#mode.update(options);
  }

  /**
   *
   * @param {number} yawDegrees
   * @param {number} pitchDegrees
   */
  lookFirstPersonBy(yawDegrees, pitchDegrees) {
    this.#mode.lookBy?.(yawDegrees, pitchDegrees);
  }

  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string}} input
   */
  pointerDown(input) {
    return this.#mode.pointerDown(input);
  }

  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string}} input
   */
  pointerMove(input) {
    return this.#mode.pointerMove(input);
  }

  /**
   *
   * @param {string|number|boolean} args
   */
  translateLocal(...args) {
    this.#entity.translateLocal(...args);
  }

  getPosition() {
    return this.#entity.getPosition();
  }

  getRotation() {
    return this.#entity.getRotation();
  }
}
