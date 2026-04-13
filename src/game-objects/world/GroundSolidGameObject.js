import { GameObject } from "src/game-objects/core/GameObject";
import { Container, TilingSprite } from "pixi.js";

export class GroundSolidGameObject extends GameObject {
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

  ensureSprite(scene, textures = {}) {
    if (this.sprite || !scene || !textures.wallTop || !textures.wallFill) return;
    const container = new Container();
    const middle = new TilingSprite({
      texture: textures.wallTop,
      width: textures.wallTop.width,
      height: textures.wallTop.height,
    });
    const left = new TilingSprite({
      texture: textures.wallTop,
      width: textures.wallTop.width,
      height: textures.wallTop.height,
    });
    const right = new TilingSprite({
      texture: textures.wallFill,
      width: textures.wallFill.width,
      height: textures.wallFill.height,
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
    scene.addChild(this.sprite);
  }

  syncSprite({
    scene,
    textures,
    viewport,
    basePixelScale,
  }) {
    this.ensureSprite(scene, textures);
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
      scene: context.scene,
      textures: context.platformTextures,
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
    });
  }
}
