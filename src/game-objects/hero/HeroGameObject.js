import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { HeroAnimationState } from "src/states/heroes/HeroAnimationState";
import { AnimatedSprite, Texture } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
import idleLeft from "assets/game/sprites/hero-custom/hero-idle-left.png";
import runLeft from "assets/game/sprites/hero-custom/hero-run-left.png";
import deathBiteLeft from "assets/game/sprites/hero-custom/hero-death-bite-left.png";
import turnLeftRight from "assets/game/sprites/hero-custom/hero-turn-left-right.png";

const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));
const HERO_IDLE_LEFT_SPRITESHEET_KEY = "hero:spritesheet:idle-left";
const HERO_IDLE_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:idle-right";
const HERO_RUN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:run-left";
const HERO_RUN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:run-right";
const HERO_DEATH_LEFT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-left";
const HERO_DEATH_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-right";
const HERO_TURN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-left-facing";
const HERO_TURN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-right-facing";
const HERO_SPRITESHEET_KEY_BY_ANIMATION_NAME = {
  idle: {
    left: HERO_IDLE_LEFT_SPRITESHEET_KEY,
    right: HERO_IDLE_RIGHT_SPRITESHEET_KEY,
  },
  run: {
    left: HERO_RUN_LEFT_SPRITESHEET_KEY,
    right: HERO_RUN_RIGHT_SPRITESHEET_KEY,
  },
  jump: {
    left: HERO_IDLE_LEFT_SPRITESHEET_KEY,
    right: HERO_IDLE_RIGHT_SPRITESHEET_KEY,
  },
  fall: {
    left: HERO_IDLE_LEFT_SPRITESHEET_KEY,
    right: HERO_IDLE_RIGHT_SPRITESHEET_KEY,
  },
  hurt: {
    left: HERO_IDLE_LEFT_SPRITESHEET_KEY,
    right: HERO_IDLE_RIGHT_SPRITESHEET_KEY,
  },
  clear: {
    left: HERO_IDLE_LEFT_SPRITESHEET_KEY,
    right: HERO_IDLE_RIGHT_SPRITESHEET_KEY,
  },
  death: {
    left: HERO_DEATH_LEFT_SPRITESHEET_KEY,
    right: HERO_DEATH_RIGHT_SPRITESHEET_KEY,
  },
  turn: {
    left: HERO_TURN_LEFT_SPRITESHEET_KEY,
    right: HERO_TURN_RIGHT_SPRITESHEET_KEY,
  },
};

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
      w: 7,
      h: 13,
      facing: 1,
      grounded: false,
      coyote: 0,
      invulnerable: 0,
      anim: 0,
      deathFacing: 1,
      prevY: 0,
      turnDuration: 0.34,
      turnRemaining: 0,
      deathElapsed: 0,
      previousRunPhase: null,
      preservedState: null,
      currentSpriteAnimationName: null,
      currentSpriteFacingKey: null,
      ...props,
    });

    this.#buildStateMachine();
    this.resetAnimationState();
  }

  #buildStateMachine() {
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("idle", new HeroAnimationState("idle"));
    this.stateMachine.add("run", new HeroAnimationState("run"));
    this.stateMachine.add("jump", new HeroAnimationState("jump"));
    this.stateMachine.add("fall", new HeroAnimationState("fall"));
    this.stateMachine.add("hurt", new HeroAnimationState("hurt"));
    this.stateMachine.add("turn", new HeroAnimationState("turn"));
    this.stateMachine.add("death", new HeroAnimationState("death"));
    this.stateMachine.add("clear", new HeroAnimationState("clear"));
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
      anim: this.anim,
      deathFacing: this.deathFacing,
      prevY: this.prevY,
      facing: this.facing,
      turnRemaining: this.turnRemaining,
      deathElapsed: this.deathElapsed,
      previousRunPhase: this.previousRunPhase,
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
      this.facing = 1;
      this.grounded = false;
      this.coyote = 0;
      this.invulnerable = 0;
      this.anim = 0;
      this.deathFacing = this.facing;
      this.prevY = this.y;
      this.preservedState = null;
      this.resetAnimationState();
    }
    return this;
  }

  requestTurn() {
    this.turnRemaining = this.turnDuration;
  }

  resetAnimationState() {
    this.turnRemaining = 0;
    this.deathElapsed = 0;
    this.previousRunPhase = null;
    this.currentSpriteAnimationName = null;
    this.currentSpriteFacingKey = null;
    this.stateMachine?.changeTo("idle");
  }

  updateAnimationState(delta, context) {
    if (!this.stateMachine) return;
    const runPhaseChanged = this.previousRunPhase !== null && this.previousRunPhase !== context.runPhase;
    if (runPhaseChanged && context.runPhase !== context.PHASE_DEAD) {
      this.deathElapsed = 0;
    }

    this.previousRunPhase = context.runPhase;
    this.turnRemaining = Math.max(0, this.turnRemaining - delta);
    if (context.runPhase === context.PHASE_DEAD) {
      this.deathElapsed += delta;
    }

    const targetState = this.resolveAnimationState(context);
    if (this.stateMachine.currentState?.name !== targetState) {
      this.stateMachine.changeTo(targetState);
    }

    this.stateMachine.update();
  }

  getAnimationFrameIndex(animation) {
    if (!animation || animation.frames <= 1) return 0;
    const animationName = this.stateMachine?.currentState?.name ?? "idle";

    if (animationName === "turn") {
      const progress = clamp(1 - this.turnRemaining / this.turnDuration, 0, 0.9999);
      return Math.min(animation.frames - 1, Math.floor(progress * animation.frames));
    }

    if (animationName === "death") {
      return Math.min(animation.frames - 1, Math.floor(this.deathElapsed * animation.fps));
    }

    return Math.floor(this.anim) % animation.frames;
  }

  resolveAnimationState(context) {
    const {
      runPhase,
      PHASE_DEAD,
      PHASE_CLEAR,
      invulnerable,
      grounded,
      vy,
      vx,
    } = context;

    if (runPhase === PHASE_DEAD) return "death";
    if (runPhase === PHASE_CLEAR) return "clear";
    if (invulnerable > 0.9) return "hurt";
    if (this.turnRemaining > 0) return "turn";
    if (!grounded) return vy > 0 ? "jump" : "fall";
    if (Math.abs(vx) > 4) return "run";
    return "idle";
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
    run,
    time,
    viewport,
    basePixelScale,
    heroWorldSize,
    heroScreenOffsetY,
    phaseDead,
    getHeroAnimation,
  }) {
    if (typeof getHeroAnimation !== "function") return this.facing;

    const animationName = this.stateMachine?.currentState?.name ?? "idle";
    const animation = getHeroAnimation(animationName);
    const sizePx = heroWorldSize * basePixelScale;
    const blinkHidden = run.phase !== phaseDead && this.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    const effectiveFacing = run.phase === phaseDead ? (this.deathFacing ?? this.facing) : this.facing;
    const facingKey = effectiveFacing > 0 ? "right" : "left";
    const animationConfig = HERO_SPRITESHEET_KEY_BY_ANIMATION_NAME[animationName]
      ?? HERO_SPRITESHEET_KEY_BY_ANIMATION_NAME.idle;
    const spritesheetKey = animationConfig?.[facingKey] ?? animationConfig?.left ?? HERO_IDLE_LEFT_SPRITESHEET_KEY;
    const animationOrFacingChanged = this.currentSpriteAnimationName !== animationName
      || this.currentSpriteFacingKey !== facingKey;
    if (animationOrFacingChanged) {
      const textures = this.constructor.assetsManager.animations.get(spritesheetKey) ?? [];
      if (textures.length === 0) {
        this.currentSpriteAnimationName = null;
        this.currentSpriteFacingKey = null;
        this.sprite.visible = false;
        return effectiveFacing;
      }
      this.sprite.textures = textures;
      this.currentSpriteAnimationName = animationName;
      this.currentSpriteFacingKey = facingKey;
    }

    const textures = this.sprite.textures ?? [];
    if (textures.length === 0) {
      this.currentSpriteAnimationName = null;
      this.currentSpriteFacingKey = null;
      this.sprite.visible = false;
      return effectiveFacing;
    }

    const frameIndex = this.getAnimationFrameIndex(animation);
    const isStateDrivenFrame = animationName === "turn" || animationName === "death";
    if (isStateDrivenFrame) {
      if (animationOrFacingChanged || this.sprite.playing) {
        this.sprite.gotoAndStop(frameIndex);
      } else if (this.sprite.currentFrame !== frameIndex) {
        this.sprite.gotoAndStop(frameIndex);
      }
    } else {
      this.sprite.animationSpeed = (animation.fps ?? 1) / 60;
      if (animationOrFacingChanged) {
        this.sprite.gotoAndPlay(frameIndex % textures.length);
      } else if (!this.sprite.playing) {
        this.sprite.play();
      }
    }

    const currentFrameIndex = isStateDrivenFrame
      ? frameIndex
      : Math.min(textures.length - 1, this.sprite.currentFrame ?? 0);
    const frameOffset = animation.frameOffsets?.[currentFrameIndex] ?? animation.frameOffsets?.[0] ?? { x: 0, y: 0 };
    const offsetX = (effectiveFacing > 0 ? -frameOffset.x : frameOffset.x) * basePixelScale;
    const offsetY = frameOffset.y * basePixelScale;

    this.sprite.visible = !blinkHidden;
    const left = viewport.x + (this.x - heroWorldSize * 0.5) * basePixelScale + offsetX;
    const top = viewport.y + viewport.height - (this.y + heroWorldSize) * basePixelScale + offsetY + heroScreenOffsetY;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = sizePx;
    this.sprite.height = sizePx;
    return effectiveFacing;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      run: context.run,
      time: context.time,
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      heroWorldSize: context.heroWorldSize,
      heroScreenOffsetY: context.heroScreenOffsetY,
      phaseDead: context.phaseDead,
      getHeroAnimation: context.getHeroAnimation,
    });
  }

  detachSprite(options = {}) {
    super.detachSprite(options);
    this.currentSpriteAnimationName = null;
    this.currentSpriteFacingKey = null;
  }
}
