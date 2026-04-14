import { GameObject } from "src/game-objects/core/GameObject";
import { Sprite } from "pixi.js";

const GOAL_BASE_WIDTH_PX = 48;
const GOAL_BASE_HEIGHT_PX = 64;
const GOAL_HITBOX_WIDTH = 4.4;

export class GoalGameObject extends GameObject {
  constructor(goal = {}) {
    super({
      x: 0,
      y: 0,
      w: GOAL_HITBOX_WIDTH,
      h: 40,
      ...goal,
    });
  }

  ensureSprite(texture) {
    if (this.sprite || !texture) return;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0);
    this.sprite.zIndex = 18;
    this.sprite.visible = false;
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
    if (!this.sprite) return;

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
