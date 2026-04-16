import {State} from "yuka";

const ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:walk:left";
const ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:walk:right";
const ENEMY_WALK_ANIMATION_SPEED = 0.13;

export class EnemyWalkState extends State {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction;
    const animationKey = this.direction > 0
      ? ENEMY_WALK_RIGHT_FRAME_ANIMATION_KEY
      : ENEMY_WALK_LEFT_FRAME_ANIMATION_KEY;

    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey) ?? [];
    owner.sprite.animationSpeed = ENEMY_WALK_ANIMATION_SPEED;
    owner.sprite.loop = true;
    owner.sprite.gotoAndPlay(0);
  }

  execute(owner) {
    const oppositeDirection = this.direction > 0 ? -1 : 1;
    const canMoveForward = owner.canContinue(this.direction);

    if (!canMoveForward) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
        owner.resetBlockedRetries();
        return;
      }
      owner.registerBlockedRetry(oppositeDirection);
      return;
    }

    if (owner.shouldTurnFromNearbyEnemy(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection);
        owner.resetBlockedRetries();
        return;
      }
      owner.registerBlockedRetry(oppositeDirection);
      return;
    }

    if (!owner.move(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
        owner.resetBlockedRetries();
        return;
      }
      owner.registerBlockedRetry(oppositeDirection);
      return;
    }
    owner.resetBlockedRetries();

    // Moving onto the last supported position still counts as "at the edge".
    if (!owner.canContinue(this.direction)) {
      owner.vx = 0;
      if (owner.canContinue(oppositeDirection)) {
        owner.turnTo(oppositeDirection, { force: true });
        owner.resetBlockedRetries();
        return;
      }
      owner.registerBlockedRetry(oppositeDirection);
      return;
    }

    if (owner.shouldTriggerBackAlert(this.direction)) {
      owner.stateMachine.changeTo(this.direction > 0 ? "alertBackRight" : "alertBackLeft");
    }
  }
}
