export class GameObject {
  constructor(props = {}) {
    Object.assign(this, props);
    this.sprite = props.sprite ?? null;
    this._originalX = Number.isFinite(this.x) ? this.x : 0;
    this._originalY = Number.isFinite(this.y) ? this.y : 0;
    this._originalWidth = Number.isFinite(this.w)
      ? this.w
      : (Number.isFinite(this.r) ? this.r * 2 : 0);
    this._originalHeight = Number.isFinite(this.h)
      ? this.h
      : (Number.isFinite(this.r) ? this.r * 2 : 0);
  }

  attach(scene) {
    if (!scene || !this.sprite) return;
    scene.addChild(this.sprite);
  }

  get originalX() {
    return this._originalX;
  }

  get originalY() {
    return this._originalY;
  }

  get originalWidth() {
    return this._originalWidth;
  }

  get originalHeight() {
    return this._originalHeight;
  }

  reset() {
    this.x = this._originalX;
    this.y = this._originalY;
    if (Number.isFinite(this.w)) {
      this.w = this._originalWidth;
    }
    if (Number.isFinite(this.h)) {
      this.h = this._originalHeight;
    }
    return this;
  }

  hideSprite() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
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
