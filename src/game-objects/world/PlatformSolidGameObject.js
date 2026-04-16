import { GameObject } from "src/game-objects/core/GameObject";
import { Texture, TilingSprite } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import platformFlyingPlatformSprite from "assets/game/sprites/platforms/platform-flying-platform-manual.png";

const PLATFORM_FLYING_TEXTURE_KEY = "platformFlyingPlatform";
const PLATFORM_FLYING_TEXTURE_CROPPED_KEY = "platformFlyingPlatformCropped";
const PLATFORM_FLYING_PLATFORM_CROP = {
  x: 0 / 64,
  y: 0 / 24,
  w: 64 / 64,
  h: 24 / 24,
};
const PLATFORM_FLYING_PLATFORM_TILE_SCALE = {
  x: 55 / 64,
  y: 2,
};

/** @extends {GameObject<TilingSprite>} */
export class PlatformSolidGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static #buildDerivedTextures() {
    this.assetsManager.addCroppedTexture(
      PLATFORM_FLYING_TEXTURE_KEY,
      PLATFORM_FLYING_TEXTURE_CROPPED_KEY,
      PLATFORM_FLYING_PLATFORM_CROP,
    );
  }

  static getLoaderSteps() {
    const loadBaseTexture = this.assetsManager.addTextureFromUrl(PLATFORM_FLYING_TEXTURE_KEY, platformFlyingPlatformSprite);
    return [
      loadBaseTexture,
      Promise.resolve(loadBaseTexture).then(() => {
        this.#buildDerivedTextures();
      }),
    ];
  }

  static getTexture() {
    return this.assetsManager.textures.get(PLATFORM_FLYING_TEXTURE_CROPPED_KEY) ?? null;
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

  _prepareSprite() {
    const texture = this.constructor.getTexture() ?? Texture.EMPTY;
    const sprite = new TilingSprite({
      texture,
      width: Math.max(1, texture.width),
      height: Math.max(1, texture.height),
    });
    sprite.visible = false;
    sprite.zIndex = 8;
    return sprite;
  }

  syncSprite({
    viewport,
    basePixelScale,
  }) {
    const texture = this.constructor.getTexture();
    if (!texture) {
      this.visible = false;
      return;
    }

    const widthPx = this.w * basePixelScale;
    const heightPx = this.h * basePixelScale;
    const left = viewport.x + this.x * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;

    this.sprite.visible = true;
    this.sprite.texture = texture;
    this.sprite.position.set(left, top);
    this.sprite.tileScale = PLATFORM_FLYING_PLATFORM_TILE_SCALE;
    this.sprite.tilePosition = { x: 0, y: 0 };
    this.sprite.width = widthPx;
    this.sprite.height = heightPx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
    });
  }
}
