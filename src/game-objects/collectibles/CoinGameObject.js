import { GameObject } from "src/game-objects/core/GameObject";
import { Sprite } from "pixi.js";

export class CoinGameObject extends GameObject {
  constructor(coin = {}) {
    super({
      x: 0,
      y: 0,
      r: 0,
      collected: false,
      phase: 0,
      baseScaleX: 1,
      ...coin,
    });

    if (!coin.phase) {
      this.phase = (this.x + this.y) * 0.1;
    }
  }

  ensureSprite(texture, sizePx) {
    if (this.sprite || !texture) return;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.visible = true;
    this.sprite.zIndex = 9;
    this.sprite.width = sizePx;
    this.sprite.height = sizePx;
    this.baseScaleX = this.sprite.scale.x;
  }

  syncSprite({
    time,
    viewport,
    basePixelScale,
    coinWorldSize,
  }) {
    const sizePx = coinWorldSize * basePixelScale;
    if (!this.sprite || this.collected) {
      this.hideSprite();
      return;
    }

    const bobOffset = Math.sin(time * 3.4 + this.phase) * 0.35;
    const spinPhase = time * 4.5 + this.phase * 1.4;
    const flip = Math.cos(spinPhase);
    const flipMagnitude = Math.max(0.16, Math.abs(flip));
    const flipSign = flip >= 0 ? 1 : -1;
    const left = viewport.x + (this.x - coinWorldSize * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + coinWorldSize * 0.5 + bobOffset) * basePixelScale;

    this.sprite.position.set(left + sizePx * 0.5, top + sizePx * 0.5);
    this.sprite.scale.x = this.baseScaleX * flipMagnitude * flipSign;
  }

  syncRender(context = {}) {
    if (this.collected) {
      this.hideSprite();
      return;
    }

    return this.syncSprite({
      time: context.time,
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      coinWorldSize: context.coinWorldSize,
    });
  }
}
