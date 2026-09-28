export class HeroJumpAction {
  /**
   *
   * @type {import("src/game/GameContracts.js").HeroMovementContract}
   */
  #heroMovement;

  /**
   *
   * @param {{moving: boolean, direction?: pc.Vec3, speed?: number}} heroMovement
   */
  constructor(heroMovement) {
    /**
     *
     * @type {import("src/game/GameContracts.js").HeroMovementContract}
     */
    this.#heroMovement = heroMovement;
  }

  invoke() {
    this.#heroMovement.jump();
  }
}
