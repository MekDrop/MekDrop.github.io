import { State } from "yuka";

export class HeroAnimationState extends State {
  constructor(name) {
    super();
    this.name = name;
  }

  enter(owner) {
    owner.player.animationState = this.name;
  }
}
