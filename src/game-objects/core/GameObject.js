export class GameObject {
  constructor(props = {}) {
    Object.assign(this, props);
    this.sprite = props.sprite ?? null;
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
