import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

export class HeroDirectionAction {
  /**
   *
   * @type {import("src/game/GameContracts.js").HeroMovementContract}
   */
  #heroMovement;
  /**
   *
   * @type {string}
   */
  #direction;
  /**
   *
   * @type {number}
   */
  #doubleTapWindow;

  /**
   *
   * @param {{moving: boolean, direction?: pc.Vec3, speed?: number}} heroMovement
   * @param {string} direction
   * @param {number} doubleTapWindow
   */
  constructor(heroMovement, direction, doubleTapWindow) {
    /**
     *
     * @type {import("src/game/GameContracts.js").HeroMovementContract}
     */
    this.#heroMovement = heroMovement;
    /**
     *
     * @type {string}
     */
    this.#direction = direction;
    /**
     *
     * @type {number}
     */
    this.#doubleTapWindow = doubleTapWindow;
  }

  /**
   *
   * @param {Event} event
   */
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
