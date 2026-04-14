import { GameObject } from "src/game-objects/core/GameObject";
import { TilingSprite } from "pixi.js";
import { createTextureLoadStep } from "src/game-objects/core/texture-loader";
import platformFlyingPlatformSprite from "assets/game/sprites/platforms/platform-flying-platform-manual.png";

const PLATFORM_FLYING_TEXTURE_KEY = "platformFlyingPlatform";

export class PlatformSolidGameObject extends GameObject {
  static getLoaderSteps(loadedTextures) {
    return [createTextureLoadStep(loadedTextures, PLATFORM_FLYING_TEXTURE_KEY, platformFlyingPlatformSprite)];
  }

  constructor(solid = {}) {
    super({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      kind: "flyingPlatform",
      ...solid,
    });
  }

  ensureSprite(texture) {
    if (this.sprite || !texture) return;
    this.sprite = new TilingSprite({
      texture,
      width: texture.width,
      height: texture.height,
    });
    this.sprite.visible = false;
    this.sprite.zIndex = 8;
  }

  syncSprite({
    texture,
    viewport,
    basePixelScale,
    tileScale = 1,
  }) {
    if (!this.sprite || !texture) {
      this.hideSprite();
      return;
    }

    const widthPx = this.w * basePixelScale;
    const heightPx = this.h * basePixelScale;
    const left = viewport.x + this.x * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;

    this.sprite.visible = true;
    this.sprite.texture = texture;
    this.sprite.position.set(left, top);
    this.sprite.tileScale = tileScale;
    this.sprite.tilePosition = { x: 0, y: 0 };
    this.sprite.width = widthPx;
    this.sprite.height = heightPx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      texture: context.platformTextures?.[this.kind],
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      tileScale: this.kind === "flyingPlatform" ? context.flyingPlatformTileScale : 1,
    });
  }
}
