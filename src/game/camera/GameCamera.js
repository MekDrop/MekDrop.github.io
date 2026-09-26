import { FirstPersonCameraMode } from "../strategies/camera/FirstPersonCameraMode.js";
import { IsometricCameraMode } from "../strategies/camera/IsometricCameraMode.js";

export class GameCamera {
  #pc;
  #entity;
  #mode;
  #zoom = 1;
  #rotation = 0;
  #panX = 0;
  #panZ = 0;
  #targetY;
  #baseOrthoHeight = 24;
  #fitCenterX = 0;
  #fitCenterZ = 0;
  #manuallyMoved = false;
  #orbitPivot = null;
  #returnTransition = null;

  constructor({ pc, app, cloudLayerId, targetY }) {
    this.#pc = pc;
    this.#targetY = targetY;
    this.#entity = new pc.Entity("Game camera");
    this.#entity.addComponent("camera", {
      clearColor: new pc.Color(0.055, 0.45, 0.72),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      nearClip: 0.1,
      farClip: 250,
    });
    this.#entity.camera.layers = [cloudLayerId, ...this.#entity.camera.layers];
    app.root.addChild(this.#entity);
    this.#mode = new IsometricCameraMode(this);
  }

  get playCanvas() {
    return this.#pc;
  }

  get entity() {
    return this.#entity;
  }

  get camera() {
    return this.#entity.camera;
  }

  get component() {
    return this.#entity.camera;
  }

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

  get panLimitsEnabled() {
    return this.#mode.panLimitsEnabled ?? false;
  }

  set panLimitsEnabled(value) {
    if ("panLimitsEnabled" in this.#mode) {
      this.#mode.panLimitsEnabled = value;
    }
  }

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

  get firstPersonEnabled() {
    return this.#mode instanceof FirstPersonCameraMode;
  }

  get firstPersonState() {
    return this.firstPersonEnabled ? this.#mode.state : null;
  }

  get viewport() {
    return {
      zoom: this.#zoom,
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      manuallyMoved: this.#manuallyMoved,
    };
  }

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

  update(options) {
    return this.#mode.update(options);
  }

  lookFirstPersonBy(yawDegrees, pitchDegrees) {
    this.#mode.lookBy?.(yawDegrees, pitchDegrees);
  }

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
