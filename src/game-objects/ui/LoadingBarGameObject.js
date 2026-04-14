import { ProgressBar } from "@pixi/ui";
import { Graphics } from "pixi.js";
import { GameObject } from "src/game-objects/core/GameObject";

const drawBar = (graphics, width, height, fillColor) => {
  graphics
    .clear()
    .roundRect(0, 0, width, height, 6)
    .fill(fillColor)
    .stroke({ width: 1, color: 0x96ffe0, alpha: fillColor === 0x06120b ? 0.34 : 0.18 });
};

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
    this.ensureSprite();
  }

  ensureSprite() {
    if (this.sprite) return;
    this.backgroundView = new Graphics();
    this.fillView = new Graphics();
    this.sprite = new ProgressBar({
      bg: this.backgroundView,
      fill: this.fillView,
      progress: this.progress,
    });
    this.resize(this.width, this.height);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.backgroundView || !this.fillView || !this.sprite) return;
    drawBar(this.backgroundView, this.width, this.height, 0x06120b);
    drawBar(this.fillView, this.width, this.height, 0x6ff0b5);
    this.sprite.width = this.width;
    this.sprite.height = this.height;
  }

  setProgress(progress) {
    this.progress = progress;
    if (!this.sprite) return;
    this.sprite.progress = progress;
  }
}
