import { AbstractModalAction } from "../../actions/AbstractModalAction.js";

export class ToggleInventoryAction extends AbstractModalAction {
  /**
   *
   * @type {import("../PlayCanvasRenderer.js").PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {import("./HeroMovementAction.js").HeroMovementAction}
   */
  #heroMovement;

  /**
   *
   * @param {import("../PlayCanvasRenderer.js").PlayCanvasRenderer} renderer
   * @param {import("./HeroMovementAction.js").HeroMovementAction} heroMovement
   */
  constructor(renderer, heroMovement) {
    super();
    /**
     *
     * @type {import("../PlayCanvasRenderer.js").PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {import("./HeroMovementAction.js").HeroMovementAction}
     */
    this.#heroMovement = heroMovement;
  }

  invoke() {
    this.#heroMovement?.clear();
    return this.toggleInventory();
  }

  /**
   *
   * @returns {boolean}
   */
  get visible() {
    return this.#renderer.inventoryVisible;
  }

  toggleInventory() {
    return this.#renderer.toggleInventory();
  }

  close() {
    return this.#renderer.closeInventory();
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pressPointer(clientX, clientY) {
    return this.#renderer.pressInventoryPointer(clientX, clientY);
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  movePointer(clientX, clientY) {
    return this.#renderer.moveInventoryPointer(clientX, clientY);
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  releasePointer(clientX, clientY) {
    return this.#renderer.releaseInventoryPointer(clientX, clientY);
  }

  leavePointer() {
    this.#renderer.leaveInventoryPointer();
  }

  cancelPointer() {
    this.#renderer.cancelInventoryPointer();
  }
}
