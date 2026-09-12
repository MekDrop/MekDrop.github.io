import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

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
    if (event.type === INPUT_EVENT_TYPE.KEY_UP) {
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
