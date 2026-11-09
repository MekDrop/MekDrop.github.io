const HERO_VIEWPORT_MARGIN = 32;
const HERO_CAMERA_CENTER_HEIGHT = 0.85;
const HERO_CAMERA_RETURN_DURATION = 0.45;
const HERO_RESPAWN_CAMERA_RETURN_DURATION = 0.32;
const MAP_FIT_ZOOM = 1;

/**
 * Follows the hero and returns a manually moved camera without owning camera state.
 */
export class HeroCameraFollow {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("./GameCamera.js").GameCamera}
   */
  #camera;
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {HTMLElement}
   */
  #container;
  /**
   * @type {number}
   */
  #pitch;
  /**
   * @type {(panOrigin?: {x: number, z: number}|null, preserveFocus?: boolean) => void}
   */
  #updateCamera;
  /**
   * @type {() => void}
   */
  #scheduleVisibility;

  /**
   * @param {{pc: typeof import("playcanvas"), camera: import("./GameCamera.js").GameCamera, canvas: HTMLCanvasElement, container: HTMLElement, pitch: number, updateCamera: (panOrigin?: {x: number, z: number}|null, preserveFocus?: boolean) => void, scheduleVisibility: () => void}} options
   */
  constructor({
    pc,
    camera,
    canvas,
    container,
    pitch,
    updateCamera,
    scheduleVisibility,
  }) {
    this.#pc = pc;
    this.#camera = camera;
    this.#canvas = canvas;
    this.#container = container;
    this.#pitch = pitch;
    this.#updateCamera = updateCamera;
    this.#scheduleVisibility = scheduleVisibility;
  }

  /**
   * @param {import("../objects/characters/hero/Hero.js").Hero} hero
   * @param {boolean} locked
   */
  follow(hero, locked) {
    if (locked) {
      return;
    }
    if (this.#camera.firstPersonEnabled) {
      this.#updateCamera();

      return;
    }
    const heroWorldPosition = hero.entity.getPosition();
    const screenPosition = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(
        heroWorldPosition.x,
        heroWorldPosition.y + HERO_CAMERA_CENTER_HEIGHT,
        heroWorldPosition.z,
      ),
    );
    const width = Math.max(1, this.#canvas.clientWidth);
    const height = Math.max(1, this.#canvas.clientHeight);
    const marginX = Math.min(HERO_VIEWPORT_MARGIN, width / 4);
    const marginY = Math.min(HERO_VIEWPORT_MARGIN, height / 4);
    const boundedX = Math.max(
      marginX,
      Math.min(width - marginX, screenPosition.x),
    );
    const boundedY = Math.max(
      marginY,
      Math.min(height - marginY, screenPosition.y),
    );
    const heroIsOutOfBounds =
      boundedX !== screenPosition.x || boundedY !== screenPosition.y;

    if (hero?.isRespawning) {
      if (heroIsOutOfBounds) {
        this.startReturn(hero, locked, false, {
          allowAutomatic: true,
          duration: HERO_RESPAWN_CAMERA_RETURN_DURATION,
          preserveFocus: true,
        });
      }
      this.#scheduleVisibility();

      return;
    }

    if (hero.isDying) {
      return;
    }

    if (this.#camera.manuallyMoved) {
      this.#scheduleVisibility();

      return;
    } else if (this.#camera.zoom > MAP_FIT_ZOOM) {
      this.#camera.panX = heroWorldPosition.x;
      this.#camera.panZ = heroWorldPosition.z;
    } else if (!heroIsOutOfBounds) {
      this.#scheduleVisibility();

      return;
    } else {
      const correction = this.#camera.screenDeltaToGround(
        screenPosition.x - boundedX,
        screenPosition.y - boundedY,
        this.#camera.zoom,
        this.#container.clientHeight,
        this.#pitch,
      );
      this.#camera.panX += correction.x;
      this.#camera.panZ += correction.z;
    }
    this.#updateCamera();
    this.#scheduleVisibility();
  }

  /**
   *
   * @param {import("../objects/characters/hero/Hero.js").Hero|null} hero
   * @param {boolean} locked
   * @param {boolean} force
   * @param {{allowAutomatic: boolean, duration: number, preserveFocus: boolean}} options
   * @param {boolean} options.allowAutomatic
   * @param {number} options.duration
   * @param {boolean} options.preserveFocus
   */
  startReturn(
    hero,
    locked,
    force = false,
    {
      allowAutomatic = false,
      duration = HERO_CAMERA_RETURN_DURATION,
      preserveFocus = false,
    } = {},
  ) {
    if (
      this.#camera.returnTransition ||
      locked ||
      (!allowAutomatic && !this.#camera.manuallyMoved) ||
      !hero ||
      !this.#camera
    ) {
      return Boolean(this.#camera.returnTransition);
    }
    const heroWorldPosition = hero.entity.getPosition();
    const screenPosition = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(
        heroWorldPosition.x,
        heroWorldPosition.y + HERO_CAMERA_CENTER_HEIGHT,
        heroWorldPosition.z,
      ),
    );
    const width = Math.max(1, this.#canvas.clientWidth);
    const height = Math.max(1, this.#canvas.clientHeight);
    const marginX = Math.min(HERO_VIEWPORT_MARGIN, width / 4);
    const marginY = Math.min(HERO_VIEWPORT_MARGIN, height / 4);
    const heroIsOutOfBounds =
      screenPosition.x < marginX ||
      screenPosition.x > width - marginX ||
      screenPosition.y < marginY ||
      screenPosition.y > height - marginY;
    if (!force && !heroIsOutOfBounds) {
      return false;
    }
    this.#camera.returnTransition = {
      elapsed: 0,
      startPanX: this.#camera.panX,
      startPanZ: this.#camera.panZ,
      duration,
      preserveFocus,
    };
    this.#camera.orbitPivot = null;

    return true;
  }

  /**
   *
   * @param {number} deltaTime
   * @param {import("../objects/characters/hero/Hero.js").Hero|null} hero
   * @param {boolean} locked
   */
  update(deltaTime, hero, locked) {
    const transition = this.#camera.returnTransition;
    if (!transition || locked || !hero || !this.#camera) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(1, transition.elapsed / transition.duration);
    const easedProgress = progress * progress * (3 - 2 * progress);
    const heroWorldPosition = hero.entity.getPosition();
    this.#camera.panX =
      transition.startPanX +
      (heroWorldPosition.x - transition.startPanX) * easedProgress;
    this.#camera.panZ =
      transition.startPanZ +
      (heroWorldPosition.z - transition.startPanZ) * easedProgress;
    if (progress >= 1) {
      this.#camera.returnTransition = null;
      this.#camera.manuallyMoved = false;
    }
    this.#updateCamera(null, transition.preserveFocus);
    this.#scheduleVisibility();
  }
}
