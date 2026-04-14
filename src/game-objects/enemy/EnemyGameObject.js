import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { EnemyAlertBackLeftState } from "src/states/enemies/EnemyAlertBackLeftState";
import { EnemyAlertBackRightState } from "src/states/enemies/EnemyAlertBackRightState";
import { EnemyWalkState } from "src/states/enemies/EnemyWalkState";
import { AnimatedSprite, Texture } from "pixi.js";
import { AssetsManager } from "src/core/AssetsManager";
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
const ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:walk:left";
const ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:walk:right";
const ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:alert:left";
const ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:alert:right";
const ENEMY_ANIMATION_CONFIG_BY_STATE = {
  walkLeft: {
    animationKey: ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY,
    frames: [0, 1, 2],
    animationSpeed: 0.13,
  },
  walkRight: {
    animationKey: ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY,
    frames: [0, 1, 2],
    animationSpeed: 0.13,
  },
  alertBackLeft: {
    animationKey: ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY,
    frames: [0, 1, 2, 3, 4],
    animationSpeed: 0.09,
  },
  alertBackRight: {
    animationKey: ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY,
    frames: [0, 1, 2, 3, 4],
    animationSpeed: 0.09,
  },
};

export class EnemyGameObject extends GameObject {
  static assetsManager = new AssetsManager();

  static getLoaderSteps() {
    return [
      this.assetsManager.addAnimationFromSpritesheet(ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY, blockyWalkSpritesheet, {
        columns: 3,
        rows: 2,
        frames: 3,
        frameKeyPrefix: `${ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY, ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY),
      this.assetsManager.addAnimationFromSpritesheet(ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY, blockyWalkSpritesheet, {
        columns: 3,
        rows: 2,
        frames: 5,
        frameKeyPrefix: `${ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY}:`,
      }),
      this.assetsManager.addFlippedAnimation(ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY, ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY),
    ];
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
      delta: 0,
      currentSpriteStateName: null,
      ...spawn,
    });

    this.#buildStateMachine();
    this.vx = this.speed * this.dir;
    this.ensureSprite();
  }

  #buildStateMachine() {
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("walkLeft", new EnemyWalkState(-1));
    this.stateMachine.add("walkRight", new EnemyWalkState(1));
    this.stateMachine.add("alertBackLeft", new EnemyAlertBackLeftState());
    this.stateMachine.add("alertBackRight", new EnemyAlertBackRightState());
    this.stateMachine.changeTo(this.dir >= 0 ? "walkRight" : "walkLeft");
  }

  setRuntime(runtime) {
    this.runtime = runtime;
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

  ensureSprite() {
    if (this.sprite) return;
    this.sprite = new AnimatedSprite([Texture.EMPTY]);
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
  }) {
    if (!this.sprite || !this.alive) {
      this.sprite?.stop?.();
      this.hideSprite();
      return;
    }

    const currentState = this.stateMachine?.currentState?.name ?? (this.dir >= 0 ? "walkRight" : "walkLeft");
    const animationConfig = ENEMY_ANIMATION_CONFIG_BY_STATE[currentState]
      ?? ENEMY_ANIMATION_CONFIG_BY_STATE.walkRight;
    const sourceTextures = this.constructor.assetsManager.animations.get(animationConfig.animationKey) ?? [];
    if (!sourceTextures?.length) {
      this.currentSpriteStateName = null;
      this.sprite?.stop?.();
      this.hideSprite();
      return;
    }

    const clipTextures = animationConfig.frames.map((frame) => sourceTextures[frame]).filter(Boolean);
    const textures = clipTextures.length > 0 ? clipTextures : [sourceTextures[0]];
    const stateChanged = this.currentSpriteStateName !== currentState;
    if (stateChanged) {
      this.sprite.textures = textures;
      this.sprite.animationSpeed = animationConfig.animationSpeed;
      this.sprite.gotoAndPlay(0);
      this.currentSpriteStateName = currentState;
    } else if (!this.sprite.playing) {
      this.sprite.play();
    }

    const left = viewport.x + (this.x - this.w * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;
    const sizePx = this.h * basePixelScale;
    this.sprite.visible = true;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = sizePx;
    this.sprite.height = sizePx;
  }

  syncRender(context = {}) {
    return this.syncSprite({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
    });
  }

  detachSprite(options = {}) {
    super.detachSprite(options);
    this.currentSpriteStateName = null;
  }
}
