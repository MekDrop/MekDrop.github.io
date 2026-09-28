export class CloseModalAction {
  /**
   * @type {import("./AbstractModalAction.js").AbstractModalAction[]}
   */
  #modals;

  /**
   *
   * @param {import("./AbstractModalAction.js").AbstractModalAction[]} modals
   */
  constructor(modals) {
    /**
     * @type {import("./AbstractModalAction.js").AbstractModalAction[]}
     */
    this.#modals = modals;
  }

  invoke() {
    for (let index = this.#modals.length - 1; index >= 0; index -= 1) {
      const modal = this.#modals[index];
      if (modal.visible) {
        return modal.close();
      }
    }
    return false;
  }
}
