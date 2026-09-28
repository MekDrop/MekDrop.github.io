export class HeroTool {
  /**
   *
    * @type {string}
   */
  #modelLibrary;
  /**
   *
    * @type {string}
   */
  #modelUrl;
  /**
   *
    * @type {string}
   */
  #name;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity = null;

  /**
   *
   * @param {{modelLibrary: string, modelUrl: string, name: string}} options
   * @param {string} options.modelLibrary
   * @param {string} options.modelUrl
   * @param {string} options.name
   */
  constructor({ modelLibrary, modelUrl, name }) {
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#name = name;
  }

  get name() {
    return this.#name;
  }

  /**
   *
    * @returns {number}
   */
  get summonDuration() {
    return 0.57;
  }

  /**
   *
    * @returns {number}
   */
  get useDuration() {
    return 0.8;
  }

  /**
   *
    * @returns {number}
   */
  get impactTime() {
    return 0.44;
  }

  /**
   *
    * @returns {number}
   */
  get dismissDuration() {
    return 0.57;
  }

  /**
   *
    * @returns {import("playcanvas").Entity}
   */
  get summonAnimation() {
    return null;
  }

  /**
   *
    * @returns {import("playcanvas").Entity}
   */
  get dismissAnimation() {
    return null;
  }

  useAnimation() {
    return null;
  }

  /**
   *
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    if (!this.#entity) {
      this.#entity = this.#modelLibrary.instantiate(this.#modelUrl);
      this.#entity.name = `${this.#name} tool instance`;
      this.#entity.setLocalPosition(0, -0.61, 0.06);
      this.#entity.enabled = false;
    }
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
  }

  set visible(visible) {
    if (this.#entity) {
      this.#entity.enabled = Boolean(visible);
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }
}
