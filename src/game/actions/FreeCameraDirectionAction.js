import { INPUT_EVENT_TYPE } from "src/game/enum/InputEventType.js";

export class FreeCameraDirectionAction {
  #heroDirection;
  #moveCamera;
  #freeCameraEnabled;

  constructor(heroDirection, moveCamera, freeCameraEnabled) {
    this.#heroDirection = heroDirection;
    this.#moveCamera = moveCamera;
    this.#freeCameraEnabled = freeCameraEnabled;
  }

  invoke(event) {
    if (event.type === INPUT_EVENT_TYPE.KEY_UP) {
      this.#heroDirection.invoke(event);
      return;
    }
    if (this.#freeCameraEnabled()) {
      this.#moveCamera();
      return;
    }
    this.#heroDirection.invoke(event);
  }
}
