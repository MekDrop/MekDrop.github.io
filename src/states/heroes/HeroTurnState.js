import { State } from "yuka";

const HERO_TURN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-left-facing";
const HERO_TURN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:turn-left-right-right-facing";

export class HeroTurnState extends State {
  constructor(direction = 1) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction > 0 ? 1 : -1;
    const animationKey = owner.dir > 0 ? HERO_TURN_RIGHT_SPRITESHEET_KEY : HERO_TURN_LEFT_SPRITESHEET_KEY;
    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey);
    owner.sprite.loop = false;
    owner.sprite.animationSpeed = 12 / 60;
    owner.sprite.onComplete = () => {
      owner.sprite.onComplete = null;
      owner.stateMachine?.changeTo(`idle${this.direction > 0 ? "Right" : "Left"}`);
    };
    owner.sprite.gotoAndPlay(0);
  }

  exit(owner) {
    owner.sprite.onComplete = null;
    owner.sprite.loop = true;
  }
}
