import { State } from "yuka";

export class EnemyWalkState extends State {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.enemy.dir = this.direction;
    owner.enemy.animationState = this.direction > 0 ? "walkRight" : "walkLeft";
  }

  execute(owner) {
    const oppositeDirection = this.direction > 0 ? -1 : 1;

    if (!owner.canContinue(this.direction)) {
      owner.enemy.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
      }
      return;
    }

    if (!owner.move(this.direction)) {
      owner.enemy.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
      }
    }
  }
}
