import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { HeroAnimationState } from "src/states/heroes/HeroAnimationState";
import { AnimatedSprite, Rectangle, Texture } from "pixi.js";

const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));

export class HeroGameObject extends GameObject {
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
      animationState: "idle",
      deathFacing: 1,
      prevY: 0,
      turnDuration: 0.34,
      turnRemaining: 0,
      deathElapsed: 0,
      previousRunPhase: null,
      spriteTextureCache: new Map(),
      spriteClipCache: new Map(),
      stateMachine: null,
      ...props,
    });
  }

  initializeStateMachine(options = {}) {
    this.turnDuration = options.turnDuration ?? this.turnDuration;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("idle", new HeroAnimationState("idle"));
    this.stateMachine.add("run", new HeroAnimationState("run"));
    this.stateMachine.add("jump", new HeroAnimationState("jump"));
    this.stateMachine.add("fall", new HeroAnimationState("fall"));
    this.stateMachine.add("hurt", new HeroAnimationState("hurt"));
    this.stateMachine.add("turn", new HeroAnimationState("turn"));
    this.stateMachine.add("death", new HeroAnimationState("death"));
    this.stateMachine.add("clear", new HeroAnimationState("clear"));
    this.resetAnimationState();
  }

  requestTurn() {
    this.turnRemaining = this.turnDuration;
  }

  resetAnimationState() {
    this.turnRemaining = 0;
    this.deathElapsed = 0;
    this.previousRunPhase = null;
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
    this.animationState = this.stateMachine.currentState?.name ?? "idle";
  }

  getAnimationFrameIndex(animation) {
    if (!animation || animation.frames <= 1) return 0;
    const animationName = this.animationState ?? "idle";

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

  ensureSprite(scene) {
    if (this.sprite || !scene) return;
    this.sprite = new AnimatedSprite([Texture.EMPTY]);
    this.sprite.anchor.set(0.5, 0);
    this.sprite.visible = false;
    this.sprite.zIndex = 20;
    this.sprite.stop();
    scene.addChild(this.sprite);
  }

  getFrameTexture({
    src,
    animation,
    frameIndex,
    getLoadedTextureByUrl,
    configurePixelTexture,
  }) {
    if (!src || !animation || typeof getLoadedTextureByUrl !== "function") return null;
    const cacheKey = `${src}:${animation.columns}x${animation.rows}:${frameIndex}`;
    if (this.spriteTextureCache.has(cacheKey)) {
      return this.spriteTextureCache.get(cacheKey);
    }

    const texture = getLoadedTextureByUrl(src);
    if (!texture) return null;
    const frameWidth = Math.floor(texture.width / animation.columns);
    const frameHeight = Math.floor(texture.height / animation.rows);
    const frameColumn = frameIndex % animation.columns;
    const frameRow = Math.floor(frameIndex / animation.columns);
    const frame = new Rectangle(
      frameColumn * frameWidth,
      frameRow * frameHeight,
      frameWidth,
      frameHeight,
    );
    const frameTexture = (typeof configurePixelTexture === "function")
      ? configurePixelTexture(new Texture({
        source: texture.source,
        frame,
      }))
      : new Texture({
        source: texture.source,
        frame,
      });

    this.spriteTextureCache.set(cacheKey, frameTexture);
    return frameTexture;
  }

  getClipTextures({
    src,
    animation,
    getLoadedTextureByUrl,
    configurePixelTexture,
  }) {
    if (!src || !animation) return [];
    const cacheKey = `${src}:${animation.columns}x${animation.rows}:${animation.frames}`;
    if (this.spriteClipCache.has(cacheKey)) {
      return this.spriteClipCache.get(cacheKey);
    }

    const textures = [];
    for (let frameIndex = 0; frameIndex < animation.frames; frameIndex++) {
      const frameTexture = this.getFrameTexture({
        src,
        animation,
        frameIndex,
        getLoadedTextureByUrl,
        configurePixelTexture,
      });
      if (frameTexture) textures.push(frameTexture);
    }

    this.spriteClipCache.set(cacheKey, textures);
    return textures;
  }

  syncSprite({
    scene,
    run,
    time,
    viewport,
    basePixelScale,
    heroWorldSize,
    heroScreenOffsetY,
    phaseDead,
    getHeroAnimation,
    getLoadedTextureByUrl,
    configurePixelTexture,
  }) {
    this.ensureSprite(scene);
    if (!this.sprite || typeof getHeroAnimation !== "function") return this.facing;

    const animationName = this.animationState ?? "idle";
    const animation = getHeroAnimation(animationName);
    const sizePx = heroWorldSize * basePixelScale;
    const blinkHidden = run.phase !== phaseDead && this.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    const effectiveFacing = run.phase === phaseDead ? (this.deathFacing ?? this.facing) : this.facing;
    const facingKey = effectiveFacing > 0 ? "right" : "left";
    const spriteSrc = animation.srcByFacing?.[facingKey] ?? animation.srcByFacing?.left ?? animation.src;
    const mirrorFacing = animation.mirrorByFacing?.[facingKey] ?? (animation.mirror && effectiveFacing > 0);
    const textures = this.getClipTextures({
      src: spriteSrc,
      animation,
      getLoadedTextureByUrl,
      configurePixelTexture,
    });
    if (textures.length === 0) {
      this.sprite.visible = false;
      return effectiveFacing;
    }

    const activeTextures = this.sprite.textures ?? [];
    const clipChanged = activeTextures.length !== textures.length || activeTextures[0] !== textures[0];
    if (clipChanged) {
      this.sprite.textures = textures;
    }

    const frameIndex = this.getAnimationFrameIndex(animation);
    const isStateDrivenFrame = animationName === "turn" || animationName === "death";
    if (isStateDrivenFrame) {
      if (clipChanged || this.sprite.playing) {
        this.sprite.gotoAndStop(frameIndex);
      } else if (this.sprite.currentFrame !== frameIndex) {
        this.sprite.gotoAndStop(frameIndex);
      }
    } else {
      this.sprite.animationSpeed = (animation.fps ?? 1) / 60;
      if (clipChanged) {
        this.sprite.gotoAndPlay(frameIndex % textures.length);
      } else if (!this.sprite.playing) {
        this.sprite.play();
      }
    }

    const currentFrameIndex = isStateDrivenFrame
      ? frameIndex
      : Math.min(textures.length - 1, this.sprite.currentFrame ?? 0);
    const frameOffset = animation.frameOffsets?.[currentFrameIndex] ?? animation.frameOffsets?.[0] ?? { x: 0, y: 0 };
    const offsetX = (mirrorFacing ? -frameOffset.x : frameOffset.x) * basePixelScale;
    const offsetY = frameOffset.y * basePixelScale;

    this.sprite.visible = !blinkHidden;
    const left = viewport.x + (this.x - heroWorldSize * 0.5) * basePixelScale + offsetX;
    const top = viewport.y + viewport.height - (this.y + heroWorldSize) * basePixelScale + offsetY + heroScreenOffsetY;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = mirrorFacing ? -sizePx : sizePx;
    this.sprite.height = sizePx;
    return effectiveFacing;
  }

  detachSprite(options = {}) {
    super.detachSprite(options);
    for (const texture of this.spriteTextureCache.values()) {
      if (!texture?.destroyed) texture.destroy(false);
    }
    this.spriteTextureCache.clear();
    this.spriteClipCache.clear();
  }
}
