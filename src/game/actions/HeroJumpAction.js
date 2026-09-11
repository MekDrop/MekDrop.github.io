export class HeroJumpAction {
  #heroMovement;

  constructor(heroMovement) {
    this.#heroMovement = heroMovement;
  }

  invoke() {
    this.#heroMovement.jump();
  }
}
