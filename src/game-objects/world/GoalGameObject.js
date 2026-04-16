import { GameObject } from "src/game-objects/core/GameObject";
import { Sprite, Texture } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import portalFrame from "assets/game/sprites/goal/portal-frame-0.png";

const GOAL_BASE_WIDTH_PX = 48;
const GOAL_BASE_HEIGHT_PX = 64;
const GOAL_HITBOX_WIDTH = 4.4;
const GOAL_TEXTURE_KEY = "portalFrame";

/** @extends {GameObject<Sprite>} */
export class GoalGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static getLoaderSteps() {
    return [this.assetsManager.addTextureFromUrl(GOAL_TEXTURE_KEY, portalFrame)];
  }

  constructor(goal = {}) {
    super({
      x: 0,
      y: 0,
      w: GOAL_HITBOX_WIDTH,
      h: 40,
      ...goal,
    });
  }

  _prepareSprite() {
    const activeTexture = this.constructor.assetsManager.textures.get(GOAL_TEXTURE_KEY) ?? null;
    const sprite = new Sprite(activeTexture ?? Texture.EMPTY);
    sprite.anchor.set(0.5, 0);
    sprite.zIndex = 18;
    sprite.visible = false;
    return sprite;
  }

  getHitbox() {
    return {
      x: this.x - this.w * 0.5,
      y: this.y,
      w: this.w,
      h: this.h,
    };
  }

  syncSprite({
    time,
    viewport,
    basePixelScale,
    isUnlocked,
  }) {
    const activeTexture = this.constructor.assetsManager.textures.get(GOAL_TEXTURE_KEY) ?? null;
    if (!activeTexture) {
      this.visible = false;
      return;
    }
    if (this.sprite.texture !== activeTexture) {
      this.sprite.texture = activeTexture;
    }

    const pulse = isUnlocked ? 1 + Math.sin(time * 3.2) * 0.04 : 0.9;
    const widthPx = GOAL_BASE_WIDTH_PX * pulse;
    const heightPx = GOAL_BASE_HEIGHT_PX * pulse;
    const left = viewport.x + this.x * basePixelScale - widthPx * 0.5;
    const top = viewport.y + viewport.height - (this.y + heightPx / basePixelScale) * basePixelScale;

    this.sprite.visible = Boolean(isUnlocked);
    this.sprite.position.set(left + widthPx * 0.5, top);
    this.sprite.width = widthPx;
    this.sprite.height = heightPx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      time: context.time,
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      isUnlocked: context.run?.doorUnlocked,
    });
  }
}
