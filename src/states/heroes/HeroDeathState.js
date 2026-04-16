import { State } from "yuka";
const HERO_DEATH_LEFT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-left";
const HERO_DEATH_RIGHT_SPRITESHEET_KEY = "hero:spritesheet:death-bite-right";

export class HeroDeathState extends State {
  constructor(direction = 1) {
    super();
    this.direction = direction;
  }

  enter(owner) {
    owner.invulnerable = 1.25;
    owner.dir = this.direction > 0 ? 1 : -1;
    owner.vx = 0;
    owner.vy = 28;

    const animationKey = owner.dir > 0 ? HERO_DEATH_RIGHT_SPRITESHEET_KEY : HERO_DEATH_LEFT_SPRITESHEET_KEY;
    owner.sprite.textures = owner.constructor.assetsManager.animations.get(animationKey);
    owner.sprite.loop = false;
    owner.sprite.animationSpeed = 10 / 60;
    owner.sprite.onComplete = () => {
      owner.sprite.onComplete = null;
      owner.onDeathAnimationComplete?.();
    };
    owner.sprite.gotoAndPlay(0);
  }

  exit(owner) {
    owner.sprite.onComplete = null;
    owner.sprite.loop = true;
  }
}
