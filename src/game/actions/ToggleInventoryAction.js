export class ToggleInventoryAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  get visible() {
    return this.#renderer.inventoryVisible;
  }

  toggleInventory() {
    return this.#renderer.toggleInventory();
  }

  closeInventory() {
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
