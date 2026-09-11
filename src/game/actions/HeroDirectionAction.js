export class HeroDirectionAction {
  #heroMovement;
  #direction;
  #doubleTapWindow;

  constructor(heroMovement, direction, doubleTapWindow) {
    this.#heroMovement = heroMovement;
    this.#direction = direction;
    this.#doubleTapWindow = doubleTapWindow;
  }

  invoke(event) {
    if (event.type === "keyup") {
      this.#heroMovement.releaseDirection(this.#direction);
      return;
    }

    this.#heroMovement.pressDirection(
      this.#direction,
      event,
      this.#doubleTapWindow,
    );
  }
}
