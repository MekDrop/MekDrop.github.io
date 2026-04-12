import { StateMachine } from "yuka";
import { EnemyAlertBackRightState } from "src/states/enemies/EnemyAlertBackRightState";
import { EnemyAlertBackLeftState } from "src/states/enemies/EnemyAlertBackLeftState";
import { EnemyWalkState } from "src/states/enemies/EnemyWalkState";

const EDGE_SUPPORT_PROBE = 1.25;
const EDGE_LOOKAHEAD = 0.9;
const PATROL_EDGE_EPSILON = 0.15;
const TURN_COOLDOWN = 0.12;
const BACK_ALERT_MAX_X = 5.75;
const BACK_ALERT_MIN_X = 0.25;
const BACK_ALERT_MAX_Y_DELTA = 3.25;
const BACK_ALERT_DURATION = 0.45;
const BACK_ALERT_COOLDOWN = 0.5;

export class EnemyStateController {
  constructor(enemy, runtime) {
    this.enemy = enemy;
    this.runtime = runtime;
    this.delta = 0;
    this.turnCooldown = 0;
    this.backAlertTimer = 0;
    this.backAlertCooldown = 0;
    this.backAlertDirection = -1;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("walkLeft", new EnemyWalkState(-1));
    this.stateMachine.add("walkRight", new EnemyWalkState(1));
    this.stateMachine.add("alertBackLeft", new EnemyAlertBackLeftState());
    this.stateMachine.add("alertBackRight", new EnemyAlertBackRightState());
    this.stateMachine.changeTo(enemy.dir >= 0 ? "walkRight" : "walkLeft");
  }

  update(delta) {
    if (!this.enemy.alive) return;
    this.delta = delta;
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);
    this.backAlertCooldown = Math.max(0, this.backAlertCooldown - delta);
    this.enemy.anim += delta * 5;
    this.stateMachine.update();
  }

  turnTo(direction) {
    if (this.turnCooldown > 0) return false;
    this.enemy.facing = direction;
    this.stateMachine.changeTo(direction > 0 ? "walkRight" : "walkLeft");
    this.turnCooldown = TURN_COOLDOWN;
    return true;
  }

  canContinue(direction) {
    const enemy = this.enemy;
    const lookaheadDistance = Math.max(EDGE_LOOKAHEAD, enemy.speed * Math.max(this.delta, 1 / 120));
    const nextX = enemy.x + direction * lookaheadDistance;
    if (direction > 0 && nextX >= enemy.maxX - PATROL_EDGE_EPSILON) return false;
    if (direction < 0 && nextX <= enemy.minX + PATROL_EDGE_EPSILON) return false;

    const probeBody = {
      x: nextX,
      y: enemy.y,
      w: enemy.w,
      h: enemy.h,
    };
    return this.runtime.solidSupportBelow(probeBody, EDGE_SUPPORT_PROBE);
  }

  shouldTriggerBackAlert(direction) {
    if (this.backAlertCooldown > 0) return false;
    const landing = this.runtime.getPlayerLandingEvent?.();
    if (!landing) return false;

    const enemy = this.enemy;
    const dx = landing.x - enemy.x;
    const dy = Math.abs(landing.y - enemy.y);
    const closeBehind = direction > 0
      ? dx <= -BACK_ALERT_MIN_X && dx >= -BACK_ALERT_MAX_X
      : dx >= BACK_ALERT_MIN_X && dx <= BACK_ALERT_MAX_X;
    const closeVertical = dy <= BACK_ALERT_MAX_Y_DELTA;
    return closeBehind && closeVertical;
  }

  startBackAlert(direction) {
    this.backAlertDirection = direction;
    this.enemy.animationState = direction > 0 ? "alertBackRight" : "alertBackLeft";
    this.enemy.facing = direction;
    this.enemy.vx = 0;
    this.enemy.vy = 0;
    this.backAlertTimer = BACK_ALERT_DURATION;
  }

  stepBackAlert(direction) {
    this.enemy.vx = 0;
    this.enemy.vy = 0;
    this.backAlertTimer -= this.delta;
    if (this.backAlertTimer > 0) return;

    this.backAlertCooldown = BACK_ALERT_COOLDOWN;
    if (this.canContinue(direction)) {
      this.stateMachine.changeTo(direction > 0 ? "walkRight" : "walkLeft");
      return;
    }
    const opposite = direction > 0 ? -1 : 1;
    if (this.canContinue(opposite)) {
      this.turnTo(opposite);
    }
  }

  move(direction) {
    const enemy = this.enemy;
    enemy.facing = direction;
    enemy.vx = direction * enemy.speed;
    enemy.vy = 0;
    const moved = this.runtime.moveBody(enemy, this.delta);
    if (moved.hitX) return false;
    return true;
  }
}
