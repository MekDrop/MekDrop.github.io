import { State } from "yuka";

export class EnemyWalkState extends State {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction;
  }

  execute(owner) {
    const oppositeDirection = this.direction > 0 ? -1 : 1;
    const canMoveForward = owner.canContinue(this.direction);

    if (!canMoveForward) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
      }
      return;
    }

    if (owner.shouldTurnFromNearbyEnemy(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
      }
      return;
    }

    if (!owner.move(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
      }
      return;
    }

    // Moving onto the last supported position still counts as "at the edge".
    if (!owner.canContinue(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
      }
      return;
    }

    if (owner.shouldTriggerBackAlert(this.direction)) {
      owner.stateMachine.changeTo(this.direction > 0 ? "alertBackRight" : "alertBackLeft");
    }
  }
}
