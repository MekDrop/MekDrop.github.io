import { GameObject } from "src/game-objects/core/GameObject";
import { Sprite, Texture } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import coinGoldSprite from "assets/game/sprites/collectibles/coin-gold.png";

const COIN_TEXTURE_KEY = "coinGold";

/** @extends {GameObject<Sprite>} */
export class CoinGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static getLoaderSteps() {
    return [this.assetsManager.addTextureFromUrl(COIN_TEXTURE_KEY, coinGoldSprite)];
  }

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

  _prepareSprite() {
    const activeTexture = this.constructor.assetsManager.textures.get(COIN_TEXTURE_KEY) ?? null;
    const sprite = new Sprite(activeTexture ?? Texture.EMPTY);
    sprite.anchor.set(0.5, 0.5);
    sprite.visible = true;
    sprite.zIndex = 9;
    sprite.width = 1;
    sprite.height = 1;
    this.baseScaleX = sprite.scale.x;
    return sprite;
  }

  syncSprite({
    time,
    viewport,
    basePixelScale,
    coinWorldSize,
  }) {
    const sizePx = coinWorldSize * basePixelScale;
    const activeTexture = this.constructor.assetsManager.textures.get(COIN_TEXTURE_KEY) ?? null;
    if (this.collected) {
      this.visible = false;
      return;
    }
    if (!activeTexture) {
      this.visible = false;
      return;
    }
    if (this.sprite.texture !== activeTexture) {
      this.sprite.texture = activeTexture;
    }
    const textureWidth = Math.max(1, this.sprite.texture.width);
    this.baseScaleX = sizePx / textureWidth;

    const bobOffset = Math.sin(time * 3.4 + this.phase) * 0.35;
    const spinPhase = time * 4.5 + this.phase * 1.4;
    const flip = Math.cos(spinPhase);
    const flipMagnitude = Math.max(0.16, Math.abs(flip));
    const flipSign = flip >= 0 ? 1 : -1;
    const left = viewport.x + (this.x - coinWorldSize * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + coinWorldSize * 0.5 + bobOffset) * basePixelScale;

    this.sprite.position.set(left + sizePx * 0.5, top + sizePx * 0.5);
    this.sprite.height = sizePx;
    this.sprite.scale.x = this.baseScaleX * flipMagnitude * flipSign;
  }

  syncRender(context = {}) {
    if (this.collected) {
      this.visible = false;
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
