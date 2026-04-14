import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { EnemyAlertBackLeftState } from "src/states/enemies/EnemyAlertBackLeftState";
import { EnemyAlertBackRightState } from "src/states/enemies/EnemyAlertBackRightState";
import { EnemyWalkState } from "src/states/enemies/EnemyWalkState";
import { AnimatedSprite } from "pixi.js";
import { createTextureLoadStep } from "src/game-objects/core/texture-loader";
import blockyWalkSpritesheet from "assets/game/sprites/enemies/blocky-creature-walk-spritesheet.png";

const EDGE_SUPPORT_PROBE = 1.25;
const EDGE_LOOKAHEAD = 0.9;
const TURN_COOLDOWN = 0.12;
const BACK_ALERT_MAX_X = 5.75;
const BACK_ALERT_MIN_X = 0.25;
const BACK_ALERT_MAX_Y_DELTA = 3.25;
const BACK_ALERT_DURATION = 0.45;
const BACK_ALERT_COOLDOWN = 0.5;
const BACK_ALERT_MIN_RUNWAY = 2.25;
const NEARBY_ENEMY_TURN_DISTANCE = 7.5;
const NEARBY_ENEMY_LANE_TOLERANCE = 2.5;
const ENEMY_SPRITESHEET_TEXTURE_KEY = "blockyWalkSpritesheet";

export class EnemyGameObject extends GameObject {
  static getLoaderSteps(loadedTextures) {
    return [createTextureLoadStep(loadedTextures, ENEMY_SPRITESHEET_TEXTURE_KEY, blockyWalkSpritesheet)];
  }

  constructor(spawn = {}, defaults = {}) {
    super({
      type: "Blocky",
      x: 0,
      y: 0,
      dir: 1,
      speed: 6,
      vx: 0,
      vy: 0,
      w: defaults.width ?? 7,
      h: defaults.height ?? 8,
      grounded: false,
      alive: true,
      turnCooldown: 0,
      backAlertTimer: 0,
      backAlertCooldown: 0,
      backAlertDirection: -1,
      runtime: null,
      stateMachine: null,
      delta: 0,
      ...spawn,
    });

    this.vx = this.speed * this.dir;
  }

  initializeStateMachine(runtime) {
    this.runtime = runtime;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("walkLeft", new EnemyWalkState(-1));
    this.stateMachine.add("walkRight", new EnemyWalkState(1));
    this.stateMachine.add("alertBackLeft", new EnemyAlertBackLeftState());
    this.stateMachine.add("alertBackRight", new EnemyAlertBackRightState());
    this.stateMachine.changeTo(this.dir >= 0 ? "walkRight" : "walkLeft");
  }

  updateState(delta) {
    if (!this.alive || !this.stateMachine) return;
    this.delta = delta;
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);
    this.backAlertCooldown = Math.max(0, this.backAlertCooldown - delta);
    this.stateMachine.update();
  }

  turnTo(direction, { force = false } = {}) {
    if (!force && this.turnCooldown > 0) return false;
    this.dir = direction;
    this.stateMachine?.changeTo(direction > 0 ? "walkRight" : "walkLeft");
    this.turnCooldown = TURN_COOLDOWN;
    return true;
  }

  canContinue(direction) {
    const lookaheadDistance = Math.max(EDGE_LOOKAHEAD, this.speed * Math.max(this.delta, 1 / 120));
    if (typeof this.runtime?.solidSupportAhead === "function") {
      return this.runtime.solidSupportAhead(this, direction, lookaheadDistance, EDGE_SUPPORT_PROBE);
    }

    const nextX = this.x + direction * lookaheadDistance;
    const probeBody = { x: nextX, y: this.y, w: this.w, h: this.h };
    return this.runtime?.solidSupportBelow?.(probeBody, EDGE_SUPPORT_PROBE) ?? false;
  }

  shouldTurnFromNearbyEnemy(direction) {
    if (typeof this.runtime?.enemyAhead !== "function") return false;
    return this.runtime.enemyAhead(this, direction, NEARBY_ENEMY_TURN_DISTANCE, NEARBY_ENEMY_LANE_TOLERANCE);
  }

  shouldTriggerBackAlert(direction) {
    if (this.turnCooldown > 0) return false;
    if (this.backAlertCooldown > 0) return false;
    if (typeof this.runtime?.solidSupportAhead === "function") {
      const hasRunway = this.runtime.solidSupportAhead(
        this,
        direction,
        Math.max(EDGE_LOOKAHEAD, BACK_ALERT_MIN_RUNWAY),
        EDGE_SUPPORT_PROBE,
      );
      if (!hasRunway) return false;
    } else if (!this.canContinue(direction)) {
      return false;
    }

    const landing = this.runtime?.getPlayerLandingEvent?.();
    if (!landing) return false;

    const dx = landing.x - this.x;
    const dy = Math.abs(landing.y - this.y);
    const closeBehind = direction > 0
      ? dx <= -BACK_ALERT_MIN_X && dx >= -BACK_ALERT_MAX_X
      : dx >= BACK_ALERT_MIN_X && dx <= BACK_ALERT_MAX_X;
    const closeVertical = dy <= BACK_ALERT_MAX_Y_DELTA;
    return closeBehind && closeVertical;
  }

  startBackAlert(direction = -1) {
    this.backAlertDirection = direction;
    this.dir = direction;
    this.vx = 0;
    this.vy = 0;
    this.backAlertTimer = BACK_ALERT_DURATION;
  }

  stepBackAlert(direction = -1) {
    this.vx = 0;
    this.vy = 0;
    this.backAlertTimer -= this.delta;
    if (this.backAlertTimer > 0) return;

    this.backAlertCooldown = BACK_ALERT_COOLDOWN;
    if (this.canContinue(direction)) {
      this.stateMachine?.changeTo(direction > 0 ? "walkRight" : "walkLeft");
      return;
    }
    const opposite = direction > 0 ? -1 : 1;
    if (this.canContinue(opposite)) {
      this.turnTo(opposite, { force: true });
    }
  }

  move(direction) {
    this.dir = direction;
    this.vx = direction * this.speed;
    this.vy = 0;
    const moved = this.runtime?.moveBody?.(this, this.delta);
    return !moved?.hitX;
  }

  ensureSprite(textures) {
    if (this.sprite || !textures?.length) return;
    this.sprite = new AnimatedSprite(textures);
    this.sprite.anchor.set(0.5, 0);
    this.sprite.visible = false;
    this.sprite.loop = true;
    this.sprite.animationSpeed = 0.12;
    this.sprite.stop();
    this.sprite.zIndex = 10;
  }

  syncSprite({
    viewport,
    basePixelScale,
    enemyTextures,
    stateFrameMap,
    sizePx,
  }) {
    if (!this.sprite || !this.alive || !enemyTextures?.length) {
      this.sprite?.stop?.();
      this.hideSprite();
      return;
    }

    const currentState = this.stateMachine?.currentState?.name ?? (this.dir >= 0 ? "walkRight" : "walkLeft");
    const stateFrames = stateFrameMap?.[currentState] ?? stateFrameMap?.walkRight ?? [0];
    const clipTextures = stateFrames
      .map((frame) => enemyTextures[frame])
      .filter(Boolean);
    const textures = clipTextures.length > 0 ? clipTextures : [enemyTextures[0]];
    const activeTextures = this.sprite.textures ?? [];
    const clipChanged = activeTextures.length !== textures.length || activeTextures[0] !== textures[0];
    if (clipChanged) {
      this.sprite.textures = textures;
      this.sprite.animationSpeed = currentState.startsWith("alertBack") ? 0.09 : 0.13;
      this.sprite.gotoAndPlay(0);
    } else if (!this.sprite.playing) {
      this.sprite.play();
    }

    const left = viewport.x + (this.x - this.w * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;
    this.sprite.visible = true;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = this.dir < 0 ? -sizePx : sizePx;
    this.sprite.height = sizePx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
      enemyTextures: context.enemyTextures,
      stateFrameMap: context.enemyStateFrameMap,
      sizePx: context.enemySizePx,
    });
  }
}
