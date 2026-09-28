export class ToggleArrowsAction {
  /**
   *
   * @type {import("src/game/GameContracts.js").StoreContract}
   */
  #debugStore;
  /**
   *
   * @type {(value: boolean|number|string|null) => void}
   */
  #onChange;
  /**
   *
   * @type {() => boolean}
   */
  #canInvoke;

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} debugStore
   * @param {(value: boolean|number|(value: boolean|number|string|null) => void|null) => void} onChange
   * @param {() => boolean} canInvoke
   */
  constructor(debugStore, onChange = () => {}, canInvoke = () => true) {
    /**
     *
     * @type {import("src/game/GameContracts.js").StoreContract}
     */
    this.#debugStore = debugStore;
    /**
     *
     * @type {(value: boolean|number|string|null) => void}
     */
    this.#onChange = onChange;
    /**
     *
     * @type {() => boolean}
     */
    this.#canInvoke = canInvoke;
  }

  invoke() {
    if (!this.#canInvoke()) {
      return;
    }
    this.toggleArrows();
  }

  toggleArrows() {
    const visible = this.#debugStore.toggleAll();
    this.#onChange(visible);
  }
}
