import {State} from "yuka";

const ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY = "blockyFrames:alert:left";
const ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY = "blockyFrames:alert:right";
const ENEMY_ALERT_ANIMATION_SPEED = 0.09;

export class EnemyAlertBackState extends State {
  constructor(direction) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction;
    owner.vx = 0;
    owner.vy = 0;
    const returnState = owner.stateMachine?.previousState?.name
      || (this.direction > 0 ? "walkRight" : "walkLeft");

    const animationKey = this.direction > 0
      ? ENEMY_ALERT_RIGHT_FRAME_ANIMATION_KEY
      : ENEMY_ALERT_LEFT_FRAME_ANIMATION_KEY;
    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey) ?? [];
    owner.sprite.animationSpeed = ENEMY_ALERT_ANIMATION_SPEED;
    owner.sprite.loop = false;
    owner.sprite.gotoAndPlay(0);
    owner.sprite.onComplete = () => {
      owner.sprite.onComplete = null;
      owner.stateMachine?.changeTo(returnState);
    };
  }

  execute(owner) {
    owner.vx = 0;
    owner.vy = 0;
  }

  exit(owner) {
    owner.sprite.onComplete = null;
    owner.sprite.loop = true;
  }
}
