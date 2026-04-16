import { State } from "yuka";

const HERO_IDLE_LEFT_SPRITESHEET_KEY = "hero:spritesheet:idle-left";
const HERO_IDLE_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:idle-right";

export class HeroJumpState extends State {
  constructor(direction = 1) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction > 0 ? 1 : -1;
    const animationKey = owner.dir > 0 ? HERO_IDLE_RIGHT_SPRITESHEET_KEY : HERO_IDLE_LEFT_SPRITESHEET_KEY;
    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey);
    owner.sprite.loop = true;
    owner.sprite.gotoAndPlay(0);
  }
}
