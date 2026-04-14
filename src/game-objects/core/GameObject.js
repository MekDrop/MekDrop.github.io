export class GameObject {
  #originalX;
  #originalY;
  #originalWidth;
  #originalHeight;

  // noinspection JSUnusedLocalSymbols
  static getLoaderSteps(loadedTextures) {
    return [];
  }

  constructor(props = {}) {
    Object.assign(this, props);
    this.loadedTextures = props.loadedTextures instanceof Map ? props.loadedTextures : null;
    this.sprite = props.sprite ?? null;
    this.#originalX = Number.isFinite(this.x) ? this.x : 0;
    this.#originalY = Number.isFinite(this.y) ? this.y : 0;
    this.#originalWidth = Number.isFinite(this.w)
      ? this.w
      : (Number.isFinite(this.r) ? this.r * 2 : 0);
    this.#originalHeight = Number.isFinite(this.h)
      ? this.h
      : (Number.isFinite(this.r) ? this.r * 2 : 0);
  }

  attach(scene) {
    if (!scene || !this.sprite) return;
    scene.addChild(this.sprite);
  }

  get originalX() {
    return this.#originalX;
  }

  get originalY() {
    return this.#originalY;
  }

  get originalWidth() {
    return this.#originalWidth;
  }

  get originalHeight() {
    return this.#originalHeight;
  }

  reset() {
    this.x = this.#originalX;
    this.y = this.#originalY;
    if (Number.isFinite(this.w)) {
      this.w = this.#originalWidth;
    }
    if (Number.isFinite(this.h)) {
      this.h = this.#originalHeight;
    }
    return this;
  }

  hideSprite() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  getLoadedTexture(id) {
    if (!id || !(this.loadedTextures instanceof Map)) return null;
    return this.loadedTextures.get(id) ?? null;
  }

  detachSprite({ destroy = false } = {}) {
    if (!this.sprite) return;
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
    if (destroy && typeof this.sprite.destroy === "function") {
      this.sprite.destroy({ children: true });
    }
    this.sprite = null;
  }
}
