import { GameObject } from "src/game-objects/core/GameObject";
import { Container, Rectangle, Texture, TilingSprite } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import platformWallSprite from "assets/game/sprites/platforms/platform-wall.png";
import platformStairSprite from "assets/game/sprites/platforms/platform-stair.png";

const PLATFORM_WALL_TEXTURE_KEY = "platformWall";
const PLATFORM_STAIR_TEXTURE_KEY = "platformStair";
const PLATFORM_WALL_TEXTURE_CROPPED_KEY = "platformWallCropped";
const PLATFORM_WALL_TOP_TEXTURE_KEY = "platformWallTop";
const PLATFORM_WALL_FILL_TEXTURE_KEY = "platformWallFill";
const PLATFORM_STAIR_TEXTURE_CROPPED_KEY = "platformStairCropped";
const PLATFORM_WALL_CROP = {
  x: 0 / 32,
  y: 12 / 32,
  w: 32 / 32,
  h: 10 / 32,
};
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

export class GroundSolidGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static #createCroppedTexture(texture, crop) {
    if (!texture) return null;
    const frame = new Rectangle(
      Math.round(texture.width * crop.x),
      Math.round(texture.height * crop.y),
      Math.round(texture.width * crop.w),
      Math.round(texture.height * crop.h),
    );

    const croppedTexture = new Texture({
      source: texture.source,
      frame,
    });
    croppedTexture.source.scaleMode = "nearest";
    return croppedTexture;
  }

  static #registerDerivedTexture(baseKey, targetKey, crop) {
    if (this.assetsManager.textures.has(targetKey)) return;
    const baseTexture = this.assetsManager.textures.get(baseKey);
    const croppedTexture = this.#createCroppedTexture(baseTexture, crop);
    if (!croppedTexture) return;
    this.assetsManager.textures.set(targetKey, croppedTexture);
  }

  static #buildDerivedTextures() {
    this.#registerDerivedTexture(PLATFORM_WALL_TEXTURE_KEY, PLATFORM_WALL_TEXTURE_CROPPED_KEY, PLATFORM_WALL_CROP);
    this.#registerDerivedTexture(PLATFORM_WALL_TEXTURE_KEY, PLATFORM_WALL_TOP_TEXTURE_KEY, PLATFORM_WALL_TOP_CROP);
    this.#registerDerivedTexture(PLATFORM_WALL_TEXTURE_KEY, PLATFORM_WALL_FILL_TEXTURE_KEY, PLATFORM_WALL_FILL_CROP);
    this.#registerDerivedTexture(PLATFORM_STAIR_TEXTURE_KEY, PLATFORM_STAIR_TEXTURE_CROPPED_KEY, PLATFORM_STAIR_CROP);
  }

  static getLoaderSteps() {
    const loadWallTexture = this.assetsManager.addTextureFromUrl(PLATFORM_WALL_TEXTURE_KEY, platformWallSprite);
    const loadStairTexture = this.assetsManager.addTextureFromUrl(PLATFORM_STAIR_TEXTURE_KEY, platformStairSprite);
    return [
      loadWallTexture,
      loadStairTexture,
      Promise.all([loadWallTexture, loadStairTexture]).then(() => {
        this.#buildDerivedTextures();
      }),
    ];
  }

  static getTextures() {
    return {
      wall: this.assetsManager.textures.get(PLATFORM_WALL_TEXTURE_CROPPED_KEY) ?? null,
      wallTop: this.assetsManager.textures.get(PLATFORM_WALL_TOP_TEXTURE_KEY) ?? null,
      wallFill: this.assetsManager.textures.get(PLATFORM_WALL_FILL_TEXTURE_KEY) ?? null,
      stair: this.assetsManager.textures.get(PLATFORM_STAIR_TEXTURE_CROPPED_KEY) ?? null,
    };
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
    this.ensureSprite();
  }

  ensureSprite() {
    if (this.sprite) return;
    const container = new Container();
    const fallbackTexture = Texture.EMPTY;
    const middle = new TilingSprite({
      texture: fallbackTexture,
      width: 1,
      height: 1,
    });
    const left = new TilingSprite({
      texture: fallbackTexture,
      width: 1,
      height: 1,
    });
    const right = new TilingSprite({
      texture: fallbackTexture,
      width: 1,
      height: 1,
    });
    container.visible = false;
    container.zIndex = 8;
    middle.visible = false;
    left.visible = false;
    right.visible = false;
    container.middle = middle;
    container.left = left;
    container.right = right;
    container.addChild(middle, right, left);
    this.sprite = container;
  }

  syncSprite({
    viewport,
    basePixelScale,
  }) {
    this.ensureSprite();
    const textures = this.constructor.getTextures();
    if (!this.sprite) {
      this.hideSprite();
      return;
    }

    const textureKey = this.wallStyle === "stair" ? "stair" : "wall";
    const texture = textures[textureKey];
    if (!texture) {
      this.hideSprite();
      return;
    }

    const widthPx = this.w * basePixelScale;
    const heightPx = this.h * basePixelScale;
    const left = viewport.x + this.x * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;

    this.sprite.visible = true;
    this.sprite.position.set(left, top);
    this.sprite.middle.position.set(0, 0);
    this.sprite.middle.tileScale = 1;
    this.sprite.middle.tilePosition = { x: 0, y: 0 };
    this.sprite.left.tileScale = 1;
    this.sprite.left.tilePosition = { x: 0, y: 0 };
    this.sprite.right.tileScale = 1;
    this.sprite.right.tilePosition = { x: 0, y: 0 };

    if (textureKey === "wall") {
      const topHeightPx = Math.min(heightPx, textures.wallTop.height);
      const fillHeightPx = Math.max(0, heightPx - topHeightPx);
      this.sprite.middle.visible = false;
      this.sprite.left.visible = true;
      this.sprite.right.visible = fillHeightPx > 0;
      this.sprite.left.texture = textures.wallTop;
      this.sprite.left.width = widthPx;
      this.sprite.left.height = topHeightPx;
      this.sprite.left.position.set(0, 0);
      this.sprite.left.tilePosition = { x: 0, y: 0 };
      this.sprite.right.texture = textures.wallFill;
      this.sprite.right.width = widthPx;
      this.sprite.right.height = fillHeightPx;
      this.sprite.right.position.set(0, topHeightPx);
      this.sprite.right.tilePosition = { x: 0, y: 0 };
      return;
    }

    this.sprite.left.visible = false;
    this.sprite.right.visible = false;
    this.sprite.middle.visible = true;
    this.sprite.middle.texture = texture;
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
