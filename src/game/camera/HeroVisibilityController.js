const CHECK_INTERVAL = 180;
const PICKER_SCALE = 0.25;
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
   * @type {(rotation: number, temporary?: boolean) => void}
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
   * @param {(rotation: number, temporary?: boolean) => void} options.setRotation
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
    this.#timer = window.setTimeout(this.#setTimeout.bind(this), delay);
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
        if (!candidateIsVisible) {
          continue;
        }
        this.#setRotation(rotation);

        return;
      }
    } finally {
      if (generation === this.#generation) {
        this.#inProgress = false;
        if (this.#checkPending) {
          this.schedule();
        }
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
      this.#setRotation(rotation, true);

      const width = Math.max(1, this.#canvas.clientWidth);
      const height = Math.max(1, this.#canvas.clientHeight);
      const pickerWidth = Math.max(1, Math.round(width * PICKER_SCALE));
      const pickerHeight = Math.max(1, Math.round(height * PICKER_SCALE));
      const sample = this.#heroScreenBounds(width, height);
      if (!sample) {
        return null;
      }

      this.#picker.resize(pickerWidth, pickerHeight);
      this.#picker.prepare(this.#camera, this.#app.scene);
      selectionPromise = this.#picker.getSelectionAsync(
        sample.x,
        sample.y,
        sample.width,
        sample.height,
      );
    } catch {
      return null;
    } finally {
      this.#setRotation(previousRotation, true);
    }

    try {
      const selection = await selectionPromise;
      if (generation !== this.#generation) {
        return null;
      }
      return selection.some(this.#someItem.bind(this));
    } catch {
      return null;
    }
  }

  /**
   * Sample the complete rendered hero: a covered torso does not mean a hidden hero.
   * @param {number} width
   * @param {number} height
   * @returns {{x: number, y: number, width: number, height: number}|null}
   */
  #heroScreenBounds(width, height) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const render of this.#hero.findComponents("render")) {
      if (!render.enabled || !render.entity.enabled) {
        continue;
      }
      for (const mesh of render.meshInstances) {
        if (!mesh.visible || mesh.pick === false) {
          continue;
        }
        const { center, halfExtents } = mesh.aabb;
        for (const x of [-1, 1]) {
          for (const y of [-1, 1]) {
            for (const z of [-1, 1]) {
              const screen = this.#camera.worldToScreen(new this.#pc.Vec3(
                center.x + x * halfExtents.x,
                center.y + y * halfExtents.y,
                center.z + z * halfExtents.z,
              ));
              left = Math.min(left, screen.x);
              top = Math.min(top, screen.y);
              right = Math.max(right, screen.x);
              bottom = Math.max(bottom, screen.y);
            }
          }
        }
      }
    }
    left = Math.max(0, Math.floor(left * PICKER_SCALE));
    top = Math.max(0, Math.floor(top * PICKER_SCALE));
    right = Math.min(Math.round(width * PICKER_SCALE), Math.ceil(right * PICKER_SCALE));
    bottom = Math.min(Math.round(height * PICKER_SCALE), Math.ceil(bottom * PICKER_SCALE));
    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
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

  #setTimeout() {
    this.#timer = null;
    this.#checkPending = false;
    void this.#keepVisible();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} item
   */
  #someItem(item) {
    return this.#belongsToHero(item?.node);
  }
}
