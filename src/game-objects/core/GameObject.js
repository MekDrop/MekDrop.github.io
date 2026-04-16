/**
 * @typedef {import("pixi.js").Container | import("pixi.js").Sprite | import("pixi.js").AnimatedSprite} PixiSpriteLike
 */

/**
 * @template {PixiSpriteLike} TSprite
 */
export class GameObject {

  #originalState;

  /** @type {TSprite | null} */
  #sprite;

  static getLoaderSteps() {
    return [];
  }

  constructor(props = {}) {
    Object.assign(this, props);
    this.#originalState = {
      x: Number.isFinite(this.x) ? this.x : 0,
      y: Number.isFinite(this.y) ? this.y : 0,
      w: Number.isFinite(this.w)
        ? this.w
        : (Number.isFinite(this.r) ? this.r * 2 : 0),
      h: Number.isFinite(this.h)
        ? this.h
        : (Number.isFinite(this.r) ? this.r * 2 : 0),
    };
    this.#sprite = this._prepareSprite();
  }

  /**
   * Prepares and returns the sprite instance for this game object.
   * Subclasses must override this method and return a PIXI display object.
   *
   * @abstract
   * @returns {*}
   * @throws {Error} When not overridden in a subclass.
   */
  _prepareSprite() {
    throw new Error(`${this.constructor.name} must override _prepareSprite()`);
  }

  /**
   * @returns {TSprite}
   */
  get sprite() {
    if (!this.#sprite) {
      this.#sprite = this._prepareSprite();
    }
    return this.#sprite;
  }

  attach(scene) {
    if (!scene) return;
    scene.addChild(this.sprite);
  }

  get originalX() {
    return this.#originalState.x;
  }

  get originalY() {
    return this.#originalState.y;
  }

  get originalWidth() {
    return this.#originalState.w;
  }

  get originalHeight() {
    return this.#originalState.h;
  }

  get visible() {
    return Boolean(this.sprite.visible);
  }

  set visible(value) {
    this.sprite.visible = Boolean(value);
  }

  reset() {
    this.x = this.#originalState.x;
    this.y = this.#originalState.y;
    if (Number.isFinite(this.w)) {
      this.w = this.#originalState.w;
    }
    if (Number.isFinite(this.h)) {
      this.h = this.#originalState.h;
    }
    return this;
  }

  detachSprite({ destroy = false } = {}) {
    const sprite = this.#sprite;
    if (!sprite) return;
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    if (destroy && typeof sprite.destroy === "function") {
      sprite.destroy({ children: true });
    }
    this.#sprite = this._prepareSprite();
  }
}
