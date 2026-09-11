export class ToggleInventoryAction {
  #renderer;
  #heroMovement;

  constructor(renderer, heroMovement) {
    this.#renderer = renderer;
    this.#heroMovement = heroMovement;
  }

  invoke() {
    this.#heroMovement?.clear();
    return this.toggleInventory();
  }

  get visible() {
    return this.#renderer.inventoryVisible;
  }

  toggleInventory() {
    return this.#renderer.toggleInventory();
  }

  close() {
    return this.#renderer.closeInventory();
  }

  pressPointer(clientX, clientY) {
    return this.#renderer.pressInventoryPointer(clientX, clientY);
  }

  movePointer(clientX, clientY) {
    return this.#renderer.moveInventoryPointer(clientX, clientY);
  }

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
