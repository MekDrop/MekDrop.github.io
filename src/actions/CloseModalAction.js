export class CloseModalAction {
  #modals;

  constructor(modals) {
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
