import { ProgressBar } from "@pixi/ui";
import { Graphics } from "pixi.js";
import { GameObject } from "src/game-objects/core/GameObject";

/** @extends {GameObject<ProgressBar>} */
export class LoadingBarGameObject extends GameObject {
  constructor(props = {}) {
    super({
      width: 320,
      height: 14,
      progress: 0,
      backgroundView: null,
      fillView: null,
      ...props,
    });
  }

  _prepareSprite() {
    this.backgroundView = new Graphics();
    this.fillView = new Graphics();
    const sprite = new ProgressBar({
      bg: this.backgroundView,
      fill: this.fillView,
      progress: this.progress,
    });
    this.width = Math.max(1, this.width);
    this.height = Math.max(1, this.height);
    this.#drawBar(this.backgroundView, this.width, this.height, 0x06120b);
    this.#drawBar(this.fillView, this.width, this.height, 0x6ff0b5);
    sprite.width = this.width;
    sprite.height = this.height;
    return sprite;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.backgroundView || !this.fillView) return;
    this.#drawBar(this.backgroundView, this.width, this.height, 0x06120b);
    this.#drawBar(this.fillView, this.width, this.height, 0x6ff0b5);
    this.sprite.width = this.width;
    this.sprite.height = this.height;
  }

  setProgress(progress) {
    this.progress = progress;
    this.sprite.progress = progress;
  }

  #drawBar(graphics, width, height, fillColor) {
    graphics
      .clear()
      .roundRect(0, 0, width, height, 6)
      .fill(fillColor)
      .stroke({ width: 1, color: 0x96ffe0, alpha: fillColor === 0x06120b ? 0.34 : 0.18 });
  }
}
