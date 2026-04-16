import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { EnemyAlertBackState } from "src/states/enemies/EnemyAlertBackState";
import { EnemyDeadState } from "src/states/enemies/EnemyDeadState";
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
const BACK_ALERT_MIN_RUNWAY = 2.25;
const NEARBY_ENEMY_TURN_DISTANCE = 7.5;
const NEARBY_ENEMY_LANE_TOLERANCE = 2.5;
const BLOCKED_RETRY_LIMIT = 10;
const DROP_OFF_SPEED = -42;
const ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:walk:left";
const ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:walk:right";
const ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:alert:left";
const ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:alert:right";

/** @extends {GameObject<AnimatedSprite>} */
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
    const { alive: spawnAlive = true, ...spawnProps } = spawn;
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
      turnCooldown: 0,
      patrolMinX: Number.NEGATIVE_INFINITY,
      patrolMaxX: Number.POSITIVE_INFINITY,
      blockedRetries: 0,
      dropOffPlatform: false,
      dropDirection: 0,
      runtime: null,
      delta: 0,
      ...spawnProps,
    });

    this.#buildStateMachine();
    this.vx = this.speed * this.dir;
    this.alive = spawnAlive;
  }

  #buildStateMachine() {
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("walkLeft", new EnemyWalkState(-1));
    this.stateMachine.add("walkRight", new EnemyWalkState(1));
    this.stateMachine.add("alertBackLeft", new EnemyAlertBackState(-1));
    this.stateMachine.add("alertBackRight", new EnemyAlertBackState(1));
    this.stateMachine.add("dead", new EnemyDeadState());
    this.stateMachine.changeTo(this.dir >= 0 ? "walkRight" : "walkLeft");
  }

  setRuntime(runtime) {
    this.runtime = runtime;
  }

  get alive() {
    return this.visible;
  }

  set alive(value) {
    const isAlive = Boolean(value);
    if (isAlive) {
      this.sprite.play();
      this.visible = true;
      if (this.stateMachine?.currentState?.name === "dead") {
        this.stateMachine.changeTo(this.dir >= 0 ? "walkRight" : "walkLeft");
      }
      return;
    }
    if (this.stateMachine) {
      this.stateMachine.changeTo("dead");
      return;
    }
    this.sprite.stop();
    this.visible = false;
  }

  updateState(delta) {
    if (!this.alive || !this.stateMachine) return;
    this.delta = delta;
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);
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
    if (this.dropOffPlatform && direction === this.dropDirection) {
      return true;
    }

    const lookaheadDistance = Math.max(EDGE_LOOKAHEAD, this.speed * Math.max(this.delta, 1 / 120));
    const nextX = this.x + direction * lookaheadDistance;
    if (nextX < this.patrolMinX || nextX > this.patrolMaxX) {
      return false;
    }

    if (typeof this.runtime?.solidSupportAhead === "function") {
      return this.runtime.solidSupportAhead(this, direction, lookaheadDistance, EDGE_SUPPORT_PROBE);
    }

    const probeBody = { x: nextX, y: this.y, w: this.w, h: this.h };
    return this.runtime?.solidSupportBelow?.(probeBody, EDGE_SUPPORT_PROBE) ?? false;
  }

  registerBlockedRetry(oppositeDirection) {
    this.blockedRetries += 1;
    if (this.blockedRetries < BLOCKED_RETRY_LIMIT) return;

    this.blockedRetries = 0;
    this.dropOffPlatform = true;
    this.dropDirection = oppositeDirection;
    this.patrolMinX = Number.NEGATIVE_INFINITY;
    this.patrolMaxX = Number.POSITIVE_INFINITY;
    this.vx = this.speed * oppositeDirection;
    this.vy = DROP_OFF_SPEED;
    this.turnTo(oppositeDirection, { force: true });
  }

  resetBlockedRetries() {
    this.blockedRetries = 0;
  }

  shouldTurnFromNearbyEnemy(direction) {
    if (typeof this.runtime?.enemyAhead !== "function") return false;
    return this.runtime.enemyAhead(this, direction, NEARBY_ENEMY_TURN_DISTANCE, NEARBY_ENEMY_LANE_TOLERANCE);
  }

  shouldTriggerBackAlert(direction) {
    if (this.turnCooldown > 0) return false;
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

  move(direction) {
    const isDroppingOffPlatform = this.dropOffPlatform && direction === this.dropDirection;
    if (!isDroppingOffPlatform) {
      const nextX = this.x + direction * this.speed * this.delta;
      if (nextX < this.patrolMinX || nextX > this.patrolMaxX) {
        this.vx = 0;
        return false;
      }
    }

    this.dir = direction;
    this.vx = direction * this.speed;
    this.vy = isDroppingOffPlatform ? DROP_OFF_SPEED : 0;
    const moved = this.runtime?.moveBody?.(this, this.delta);
    if (!isDroppingOffPlatform && Number.isFinite(this.patrolMinX) && Number.isFinite(this.patrolMaxX)) {
      this.x = Math.min(this.patrolMaxX, Math.max(this.patrolMinX, this.x));
    }
    if (isDroppingOffPlatform && this.grounded) {
      this.dropOffPlatform = false;
      this.dropDirection = 0;
      this.vy = 0;
    }
    return !moved?.hitX;
  }

  _prepareSprite() {
    const sprite = new AnimatedSprite([Texture.EMPTY]);
    sprite.anchor.set(0.5, 0);
    sprite.visible = false;
    sprite.loop = true;
    sprite.animationSpeed = 0.12;
    sprite.stop();
    sprite.zIndex = 10;
    return sprite;
  }

  syncTransform({
    viewport,
    basePixelScale,
  }) {
    if (!this.visible) return;

    const left = viewport.x + (this.x - this.w * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;
    const sizePx = this.h * basePixelScale;
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = sizePx;
    this.sprite.height = sizePx;
  }

  syncRender(context = {}) {
    return this.syncTransform({
      viewport: context.viewport,
      basePixelScale: context.basePixelScale,
    });
  }

}
