export class GameObject {
  constructor(props = {}) {
    Object.assign(this, props);
    this.active = props.active ?? true;
    this.sprite = props.sprite ?? null;
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
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
