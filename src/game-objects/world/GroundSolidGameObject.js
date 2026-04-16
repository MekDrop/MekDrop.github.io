import { GameObject } from "src/game-objects/core/GameObject";
import { Container, Texture, TilingSprite } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import platformWallSprite from "assets/game/sprites/platforms/platform-wall.png";
import platformStairSprite from "assets/game/sprites/platforms/platform-stair.png";

const PLATFORM_WALL_TEXTURE_KEY = "platformWall";
const PLATFORM_STAIR_TEXTURE_KEY = "platformStair";
const PLATFORM_WALL_TOP_TEXTURE_KEY = "platformWallTop";
const PLATFORM_WALL_FILL_TEXTURE_KEY = "platformWallFill";
const PLATFORM_STAIR_TEXTURE_CROPPED_KEY = "platformStairCropped";
const PLATFORM_WALL_TOP_CROP = {
  x: 0 / 32,
  y: 12 / 32,
  w: 32 / 32,
  h: 4 / 32,
};
const PLATFORM_WALL_FILL_CROP = {
  x: 0 / 32,
  y: 16 / 32,
  w: 32 / 32,
  h: 4 / 32,
};
const PLATFORM_STAIR_CROP = {
  x: 5 / 64,
  y: 3 / 32,
  w: 54 / 64,
  h: 26 / 32,
};

/**
 * @typedef {Container & {
 *   middle: TilingSprite,
 *   left: TilingSprite,
 *   right: TilingSprite
 * }} GroundSpriteContainer
 */

/** @extends {GameObject<GroundSpriteContainer>} */
export class GroundSolidGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static getLoaderSteps() {
    return [
      this.assetsManager.addTextureFromUrl(PLATFORM_WALL_TEXTURE_KEY, platformWallSprite),
      this.assetsManager.addTextureFromUrl(PLATFORM_STAIR_TEXTURE_KEY, platformStairSprite),
      this.assetsManager.addCroppedTexture(PLATFORM_WALL_TEXTURE_KEY, PLATFORM_WALL_TOP_TEXTURE_KEY, PLATFORM_WALL_TOP_CROP),
      this.assetsManager.addCroppedTexture(PLATFORM_WALL_TEXTURE_KEY, PLATFORM_WALL_FILL_TEXTURE_KEY, PLATFORM_WALL_FILL_CROP),
      this.assetsManager.addCroppedTexture(PLATFORM_STAIR_TEXTURE_KEY, PLATFORM_STAIR_TEXTURE_CROPPED_KEY, PLATFORM_STAIR_CROP),
    ];
  }

  constructor(solid = {}) {
    super({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      kind: "wall",
      ...solid,
    });
  }

  _prepareSprite() {
    const wallTopTexture = this.constructor.assetsManager.textures.get(PLATFORM_WALL_TOP_TEXTURE_KEY) ?? Texture.EMPTY;
    const wallFillTexture = this.constructor.assetsManager.textures.get(PLATFORM_WALL_FILL_TEXTURE_KEY) ?? Texture.EMPTY;
    const stairTexture = this.constructor.assetsManager.textures.get(PLATFORM_STAIR_TEXTURE_CROPPED_KEY) ?? Texture.EMPTY;
    const isStair = this.wallStyle === "stair";
    const container = new Container();
    const fallbackTexture = Texture.EMPTY;
    const middle = new TilingSprite({
      texture: isStair ? stairTexture : fallbackTexture,
      width: 1,
      height: 1,
    });
    const left = new TilingSprite({
      texture: isStair ? fallbackTexture : wallTopTexture,
      width: 1,
      height: 1,
    });
    const right = new TilingSprite({
      texture: isStair ? fallbackTexture : wallFillTexture,
      width: 1,
      height: 1,
    });
    container.visible = true;
    container.zIndex = 8;
    middle.visible = isStair;
    left.visible = !isStair;
    right.visible = false;
    middle.position.set(0, 0);
    left.position.set(0, 0);
    middle.tileScale = 1;
    middle.tilePosition = { x: 0, y: 0 };
    left.tileScale = 1;
    left.tilePosition = { x: 0, y: 0 };
    right.tileScale = 1;
    right.tilePosition = { x: 0, y: 0 };
    container.middle = middle;
    container.left = left;
    container.right = right;
    container.isStair = isStair;
    container.visible = true;
    container.addChild(middle, right, left);
    return container;
  }

  syncSprite({
    viewport,
    basePixelScale,
  }) {
    const widthPx = this.w * basePixelScale;
    const heightPx = this.h * basePixelScale;
    const left = viewport.x + this.x * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;

    this.sprite.position.set(left, top);

    if (!this.sprite.isStair) {
      const topHeightPx = Math.min(heightPx, this.sprite.left.texture.height);
      const fillHeightPx = Math.max(0, heightPx - topHeightPx);
      this.sprite.right.visible = fillHeightPx > 0;
      this.sprite.left.width = widthPx;
      this.sprite.left.height = topHeightPx;
      this.sprite.right.width = widthPx;
      this.sprite.right.height = fillHeightPx;
      this.sprite.right.position.set(0, topHeightPx);
      return;
    }

    this.sprite.middle.width = widthPx;
    this.sprite.middle.height = heightPx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
    });
  }
}
