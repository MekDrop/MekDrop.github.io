const CHECK_INTERVAL = 180;
const PICKER_SCALE = 0.25;
const SAMPLE_WIDTH = 18;
const SAMPLE_HEIGHT = 28;
const HERO_CENTER_HEIGHT = 0.85;
const ROTATION_COUNT = 4;
const ALTERNATE_ROTATIONS = [-1, 1, 2];

export class HeroVisibilityController {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   *
   * @type {pc.Entity}
   */
  #camera;
  /**
   *
   * @type {Hero}
   */
  #hero;
  /**
   *
   * @type {() => number}
   */
  #getRotation;
  /**
   *
   * @type {(rotation: number) => void}
   */
  #setRotation;
  /**
   *
   * @type {boolean}
   */
  #shouldPreserveRotation;
  /**
   *
   * @type {pc.Picker}
   */
  #picker;
  /**
   *
   * @type {null}
   */
  #timer = null;
  /**
   *
   * @type {boolean}
   */
  #inProgress = false;
  /**
   *
   * @type {boolean}
   */
  #checkPending = false;
  /**
   *
   * @type {number}
   */
  #lastCheckTime = 0;
  /**
   *
   * @type {number}
   */
  #generation = 0;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, canvas: HTMLCanvasElement, camera: pc.Entity, getRotation: () => number, setRotation: (rotation: number) => void, shouldPreserveRotation: boolean}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {HTMLCanvasElement} options.canvas
   * @param {pc.Entity} options.camera
   * @param {{entity: pc.Entity, position?: pc.Vec3, visible?: boolean}} options.hero
   * @param {() => number} options.getRotation
   * @param {(rotation: number) => void} options.setRotation
   * @param {boolean} options.shouldPreserveRotation
   */
  constructor({
    pc,
    app,
    canvas,
    camera,
    hero,
    getRotation,
    setRotation,
    shouldPreserveRotation = null,
  }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {HTMLCanvasElement}
     */
    this.#canvas = canvas;
    /**
     *
     * @type {pc.Entity}
     */
    this.#camera = camera;
    /**
     *
     * @type {Hero}
     */
    this.#hero = hero;
    /**
     *
     * @type {() => number}
     */
    this.#getRotation = getRotation;
    /**
     *
     * @type {(rotation: number) => void}
     */
    this.#setRotation = setRotation;
    /**
     *
     * @type {boolean}
     */
    this.#shouldPreserveRotation = shouldPreserveRotation;
    /**
     *
     * @type {pc.Picker}
     */
    this.#picker = new pc.Picker(app, 1, 1);
  }

  schedule() {
    if (!this.#picker || !this.#hero) {
      return;
    }
    if (this.#rotationShouldBePreserved()) {
      this.#checkPending = false;
      if (this.#timer !== null) {
        window.clearTimeout(this.#timer);
        this.#timer = null;
      }
      return;
    }
    this.#checkPending = true;
    if (this.#timer !== null || this.#inProgress) {
      return;
    }

    const elapsed = performance.now() - this.#lastCheckTime;
    const delay = Math.max(0, CHECK_INTERVAL - elapsed);
    this.#timer = window.setTimeout(() => {
      this.#timer = null;
      this.#checkPending = false;
      void this.#keepVisible();
    }, delay);
  }

  destroy() {
    if (this.#timer !== null) {
      window.clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#checkPending = false;
    this.#inProgress = false;
    this.#generation += 1;
    this.#picker?.destroy();
    this.#picker = null;
    this.#hero = null;
  }

  async #keepVisible() {
    if (
      !this.#picker ||
      !this.#hero ||
      this.#rotationShouldBePreserved()
    ) {
      return;
    }
    const generation = this.#generation;
    this.#inProgress = true;
    this.#lastCheckTime = performance.now();

    try {
      const currentRotation = this.#getRotation();
      const visible = await this.#isVisibleAtRotation(
        currentRotation,
        generation,
      );
      if (
        visible !== false ||
        generation !== this.#generation ||
        this.#rotationShouldBePreserved()
      ) {
        return;
      }

      for (const offset of ALTERNATE_ROTATIONS) {
        if (this.#rotationShouldBePreserved()) {
          return;
        }
        const rotation = this.#normalizeRotation(currentRotation + offset);
        const candidateIsVisible = await this.#isVisibleAtRotation(
          rotation,
          generation,
        );
        if (generation !== this.#generation) {
          return;
        }
        if (this.#rotationShouldBePreserved()) {
          return;
        }
        if (!candidateIsVisible) continue;
        this.#setRotation(rotation);
        return;
      }
    } finally {
      if (generation === this.#generation) {
        this.#inProgress = false;
        if (this.#checkPending) this.schedule();
      }
    }
  }

  /**
   *
   * @param {pc.Vec3} rotation
   * @param {{id?: number, complete?: boolean}} generation
   */
  async #isVisibleAtRotation(rotation, generation) {
    if (
      !this.#picker ||
      !this.#hero ||
      !this.#camera ||
      this.#rotationShouldBePreserved()
    ) {
      return null;
    }

    const previousRotation = this.#getRotation();
    let selectionPromise;
    try {
      this.#setRotation(rotation);

      const width = Math.max(1, this.#canvas.clientWidth);
      const height = Math.max(1, this.#canvas.clientHeight);
      const pickerWidth = Math.max(1, Math.round(width * PICKER_SCALE));
      const pickerHeight = Math.max(1, Math.round(height * PICKER_SCALE));
      const heroPosition = this.#hero.getPosition();
      const screenPosition = this.#camera.worldToScreen(
        new this.#pc.Vec3(
          heroPosition.x,
          heroPosition.y + HERO_CENTER_HEIGHT,
          heroPosition.z,
        ),
      );
      const sampleWidth = Math.max(1, Math.round(SAMPLE_WIDTH * PICKER_SCALE));
      const sampleHeight = Math.max(
        1,
        Math.round(SAMPLE_HEIGHT * PICKER_SCALE),
      );
      const sampleX = screenPosition.x * PICKER_SCALE - sampleWidth / 2;
      const sampleY = screenPosition.y * PICKER_SCALE - sampleHeight / 2;

      this.#picker.resize(pickerWidth, pickerHeight);
      this.#picker.prepare(this.#camera, this.#app.scene);
      selectionPromise = this.#picker.getSelectionAsync(
        sampleX,
        sampleY,
        sampleWidth,
        sampleHeight,
      );
    } catch {
      return null;
    } finally {
      this.#setRotation(previousRotation);
    }

    try {
      const selection = await selectionPromise;
      if (generation !== this.#generation) {
        return null;
      }
      return selection.some(/**
       *
       * @param {import("src/game/GameContracts.js").GameObjectContract} item
       */
      (item) => this.#belongsToHero(item?.node));
    } catch {
      return null;
    }
  }

  /**
   *
   * @param {pc.GraphNode} node
   */
  #belongsToHero(node) {
    for (let current = node; current; current = current.parent) {
      if (current === this.#hero) {
        return true;
      }
    }
    return false;
  }

  /**
   *
   * @param {pc.Vec3} rotation
   */
  #normalizeRotation(rotation) {
    return ((rotation % ROTATION_COUNT) + ROTATION_COUNT) % ROTATION_COUNT;
  }

  #rotationShouldBePreserved() {
    try {
      return Boolean(this.#shouldPreserveRotation?.());
    } catch {
      return false;
    }
  }
}
