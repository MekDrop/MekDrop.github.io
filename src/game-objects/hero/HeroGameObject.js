import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { HeroIdleState } from "src/states/heroes/HeroIdleState";
import { HeroRunState } from "src/states/heroes/HeroRunState";
import { HeroJumpState } from "src/states/heroes/HeroJumpState";
import { HeroFallState } from "src/states/heroes/HeroFallState";
import { HeroHurtState } from "src/states/heroes/HeroHurtState";
import { HeroTurnState } from "src/states/heroes/HeroTurnState";
import { HeroDeathState } from "src/states/heroes/HeroDeathState";
import { HeroClearState } from "src/states/heroes/HeroClearState";
import { AnimatedSprite, Texture } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import idleLeft from "assets/game/sprites/hero-custom/hero-idle-left.png";
import runLeft from "assets/game/sprites/hero-custom/hero-run-left.png";
import deathBiteLeft from "assets/game/sprites/hero-custom/hero-death-bite-left.png";
import turnLeftRight from "assets/game/sprites/hero-custom/hero-turn-left-right.png";
const HERO_IDLE_LEFT_SPRITESHEET_KEY = "hero:spritesheet:idle-left";
const HERO_IDLE_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:idle-right";
const HERO_RUN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:run-left";
const HERO_RUN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:run-right";
const HERO_DEATH_LEFT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-left";
const HERO_DEATH_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-right";
const HERO_TURN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-left-facing";
const HERO_TURN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-right-facing";

/** @extends {GameObject<import("pixi.js").AnimatedSprite>} */
export class HeroGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static getLoaderSteps() {
    return [
      this.assetsManager.addAnimationFromSpritesheet(HERO_IDLE_LEFT_SPRITESHEET_KEY, idleLeft, {
        columns: 1,
        rows: 1,
        frames: 1,
        frameKeyPrefix: `${HERO_IDLE_LEFT_SPRITESHEET_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(HERO_IDLE_LEFT_SPRITESHEET_KEY, HERO_IDLE_RIGHT_SPRITESHEET_KEY),
      this.assetsManager.addAnimationFromSpritesheet(HERO_RUN_LEFT_SPRITESHEET_KEY, runLeft, {
        columns: 3,
        rows: 3,
        frames: 7,
        frameKeyPrefix: `${HERO_RUN_LEFT_SPRITESHEET_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(HERO_RUN_LEFT_SPRITESHEET_KEY, HERO_RUN_RIGHT_SPRITESHEET_KEY),
      this.assetsManager.addAnimationFromSpritesheet(HERO_DEATH_LEFT_SPRITESHEET_KEY, deathBiteLeft, {
        columns: 4,
        rows: 4,
        frames: 13,
        frameKeyPrefix: `${HERO_DEATH_LEFT_SPRITESHEET_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(HERO_DEATH_LEFT_SPRITESHEET_KEY, HERO_DEATH_RIGHT_SPRITESHEET_KEY),
      this.assetsManager.addAnimationFromSpritesheet(HERO_TURN_LEFT_SPRITESHEET_KEY, turnLeftRight, {
        columns: 3,
        rows: 2,
        frames: 5,
        frameKeyPrefix: `${HERO_TURN_LEFT_SPRITESHEET_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(HERO_TURN_LEFT_SPRITESHEET_KEY, HERO_TURN_RIGHT_SPRITESHEET_KEY),
    ];
  }

  constructor(props = {}) {
    super({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dir: 1,
      w: 7,
      h: 13,
      grounded: false,
      coyote: 0,
      invulnerable: 0,
      prevY: 0,
      preservedState: null,
      ...props,
    });

    this.#buildStateMachine();
  }

  #buildStateMachine() {
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("idleLeft", new HeroIdleState(-1));
    this.stateMachine.add("idleRight", new HeroIdleState(1));
    this.stateMachine.add("runLeft", new HeroRunState(-1));
    this.stateMachine.add("runRight", new HeroRunState(1));
    this.stateMachine.add("jumpLeft", new HeroJumpState(-1));
    this.stateMachine.add("jumpRight", new HeroJumpState(1));
    this.stateMachine.add("fallLeft", new HeroFallState(-1));
    this.stateMachine.add("fallRight", new HeroFallState(1));
    this.stateMachine.add("hurtLeft", new HeroHurtState(-1));
    this.stateMachine.add("hurtRight", new HeroHurtState(1));
    this.stateMachine.add("turnLeft", new HeroTurnState(-1));
    this.stateMachine.add("turnRight", new HeroTurnState(1));
    this.stateMachine.add("deathLeft", new HeroDeathState(-1));
    this.stateMachine.add("deathRight", new HeroDeathState(1));
    this.stateMachine.add("clearLeft", new HeroClearState(-1));
    this.stateMachine.add("clearRight", new HeroClearState(1));
  }

  captureRuntimeState() {
    this.preservedState = {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      grounded: this.grounded,
      coyote: this.coyote,
      invulnerable: this.invulnerable,
      prevY: this.prevY,
      dir: this.dir,
    };
    return this.preservedState;
  }

  restoreRuntimeState() {
    if (!this.preservedState) return false;
    Object.assign(this, this.preservedState);
    this.preservedState = null;
    return true;
  }

  reset(mode = 1) {
    super.reset();
    if (mode === 0) {
      this.vx = 0;
      this.vy = 0;
      this.dir = 1;
      this.grounded = false;
      this.coyote = 0;
      this.invulnerable = 0;
      this.prevY = this.y;
      this.preservedState = null;
      this.resetAnimationState();
    }
    return this;
  }

  resetAnimationState() {
    this.stateMachine?.changeTo(`idle${this.dir > 0 ? "Right" : "Left"}`);
  }

  _prepareSprite() {
    const sprite = new AnimatedSprite([Texture.EMPTY]);
    sprite.anchor.set(0.5, 0);
    sprite.visible = false;
    sprite.zIndex = 20;
    sprite.stop();
    return sprite;
  }

  syncSprite({
    viewport,
    basePixelScale,
    heroWorldSize,
    heroScreenOffsetY,
  }) {
    const sizePx = heroWorldSize * basePixelScale;
    const effectiveDirection = this.dir > 0 ? 1 : -1;
    const offsetX = 0;
    const offsetY = 0;

    this.sprite.visible = true;
    const left = viewport.x + (this.x - heroWorldSize * 0.5) * basePixelScale + offsetX;
    const top = viewport.y + viewport.height - (this.y + heroWorldSize) * basePixelScale + offsetY + heroScreenOffsetY;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = sizePx;
    this.sprite.height = sizePx;
    return effectiveDirection;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      heroWorldSize: context.heroWorldSize,
      heroScreenOffsetY: context.heroScreenOffsetY,
    });
  }

}
