import { StateMachine } from "yuka";
import { EnemyWalkState } from "src/states/enemies/EnemyWalkState";

const EDGE_SUPPORT_PROBE = 1.25;
const EDGE_LOOKAHEAD = 0.9;
const PATROL_EDGE_EPSILON = 0.15;
const TURN_COOLDOWN = 0.12;

export class EnemyStateController {
  constructor(enemy, runtime) {
    this.enemy = enemy;
    this.runtime = runtime;
    this.delta = 0;
    this.turnCooldown = 0;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add("walkLeft", new EnemyWalkState(-1));
    this.stateMachine.add("walkRight", new EnemyWalkState(1));
    this.stateMachine.changeTo(enemy.dir >= 0 ? "walkRight" : "walkLeft");
  }

  update(delta) {
    if (!this.enemy.alive) return;
    this.delta = delta;
    this.turnCooldown = Math.max(0, this.turnCooldown - delta);
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
