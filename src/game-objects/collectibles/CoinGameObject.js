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
      ...coin,
    });

    if (!coin.phase) {
      this.phase = (this.x + this.y) * 0.1;
    }
  }

  ensureSprite(scene, texture) {
    if (this.sprite || !scene || !texture) return;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.visible = false;
    this.sprite.zIndex = 12;
    scene.addChild(this.sprite);
  }

  syncSprite({
    scene,
    texture,
    time,
    viewport,
    basePixelScale,
    coinWorldSize,
  }) {
    this.ensureSprite(scene, texture);
    if (!this.sprite || this.collected) {
      this.hideSprite();
      return;
    }

    const sizePx = coinWorldSize * basePixelScale;
    const bobOffset = Math.sin(time * 3.4 + this.phase) * 0.35;
    const spinPhase = time * 4.5 + this.phase * 1.4;
    const spinScale = Math.max(0.16, Math.abs(Math.sin(spinPhase)));
    const left = viewport.x + (this.x - coinWorldSize * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + coinWorldSize * 0.5 + bobOffset) * basePixelScale;

    this.sprite.visible = true;
    this.sprite.position.set(left + sizePx * 0.5, top + sizePx * 0.5);
    this.sprite.width = sizePx * spinScale;
    this.sprite.height = sizePx;
  }
}
