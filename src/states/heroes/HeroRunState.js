import { State } from "yuka";

const HERO_RUN_LEFT_SPRITESHEET_KEY = "hero:spritesheet:run-left";
const HERO_RUN_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:run-right";

export class HeroRunState extends State {
  constructor(direction = 1) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.dir = this.direction > 0 ? 1 : -1;
    const animationKey = owner.dir > 0 ? HERO_RUN_RIGHT_SPRITESHEET_KEY : HERO_RUN_LEFT_SPRITESHEET_KEY;
    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey);
    owner.sprite.loop = true;
    owner.sprite.animationSpeed = 10 / 60;
    owner.sprite.gotoAndPlay(0);
  }
}
