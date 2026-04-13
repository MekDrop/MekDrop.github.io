import { GameObject } from "src/game-objects/core/GameObject";
import { StateMachine } from "yuka";
import { EnemyAlertBackLeftState } from "src/states/enemies/EnemyAlertBackLeftState";
import { EnemyAlertBackRightState } from "src/states/enemies/EnemyAlertBackRightState";
import { EnemyWalkState } from "src/states/enemies/EnemyWalkState";
import { Sprite } from "pixi.js";

const EDGE_SUPPORT_PROBE = 1.25;
const EDGE_LOOKAHEAD = 0.9;
const TURN_COOLDOWN = 0.12;
const BACK_ALERT_MAX_X = 5.75;
const BACK_ALERT_MIN_X = 0.25;
const BACK_ALERT_MAX_Y_DELTA = 3.25;
const BACK_ALERT_DURATION = 0.45;
const BACK_ALERT_COOLDOWN = 0.5;

export class EnemyGameObject extends GameObject {
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
      facing: spawn.dir >= 0 ? 1 : -1,
      animationState: spawn.dir >= 0 ? "walkRight" : "walkLeft",
      grounded: false,
      alive: true,
      anim: Math.random() * Math.PI * 2,
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
    this.anim += delta * 5;
    this.stateMachine.update();
  }

  turnTo(direction) {
    if (this.turnCooldown > 0) return false;
    this.facing = direction;
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

  shouldTriggerBackAlert(direction) {
    if (this.backAlertCooldown > 0) return false;
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
    this.animationState = direction > 0 ? "alertBackRight" : "alertBackLeft";
    this.facing = direction;
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
      this.turnTo(opposite);
    }
  }

  move(direction) {
    this.facing = direction;
    this.vx = direction * this.speed;
    this.vy = 0;
    const moved = this.runtime?.moveBody?.(this, this.delta);
    return !moved?.hitX;
  }

  ensureSprite(scene, texture) {
    if (this.sprite || !scene || !texture) return;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0);
    this.sprite.visible = false;
    this.sprite.zIndex = 10;
    scene.addChild(this.sprite);
  }

  syncSprite({
    scene,
    viewport,
    basePixelScale,
    enemyTextures,
    stateFrameMap,
    sizePx,
  }) {
    this.ensureSprite(scene, enemyTextures?.[0]);
    if (!this.sprite || !this.alive || !enemyTextures?.length) {
      this.hideSprite();
      return;
    }

    const stateFrames = stateFrameMap?.[this.animationState] ?? stateFrameMap?.walkRight ?? [0];
    const frameIndex = stateFrames[Math.floor(this.anim * 0.8) % stateFrames.length] ?? 0;
    const left = viewport.x + (this.x - this.w * 0.5) * basePixelScale;
    const top = viewport.y + viewport.height - (this.y + this.h) * basePixelScale;
    this.sprite.visible = true;
    this.sprite.texture = enemyTextures[frameIndex];
    this.sprite.position.set(left + sizePx * 0.5, top);
    this.sprite.width = this.facing < 0 ? -sizePx : sizePx;
    this.sprite.height = sizePx;
  }
}
