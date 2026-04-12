import { State } from "yuka";

export class EnemyWalkState extends State {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction;
    owner.animationState = this.direction > 0 ? "walkRight" : "walkLeft";
  }

  execute(owner) {
    const oppositeDirection = this.direction > 0 ? -1 : 1;

    if (owner.shouldTriggerBackAlert(this.direction)) {
      owner.stateMachine.changeTo(this.direction > 0 ? "alertBackRight" : "alertBackLeft");
      return;
    }

    if (!owner.canContinue(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
      }
      return;
    }

    if (!owner.move(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
      }
    }
  }
}
