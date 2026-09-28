import { Hero } from "../../objects/hero/index.js";
import { ThrownInventoryItem } from "../../objects/inventory/index.js";
import { InventoryHud } from "../../ui/index.js";

export class InventoryScene {
  /**
   *
   * @type {InventoryHud|null}
   */
  #hud = null;
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
   * @type {import("src/game/GameContracts.js").StoreContract}
   */
  #heroConfigurationStore;
  /**
   *
   * @type {() => Hero|null}
   */
  #getHero;
  /**
   *
   * @type {() => pc.Entity}
   */
  #getMapRoot;
  /**
   *
   * @type {() => {position: pc.Vec3, rotation?: pc.Quat}|null}
   */
  #getDropPlacement;
  /**
   *
   * @type {Array}
   */
  #thrownItems = [];

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, modelLibrary: GameModelLibrary, heroConfigurationStore: import("src/game/GameContracts.js").StoreContract, translate: (key: string, values?: {[key: string]: string|number}) => string, getHero: () => Hero|null, getMapRoot: () => pc.Entity, getDropPlacement?: () => {position: pc.Vec3, rotation?: pc.Quat}|null}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameModelLibrary} options.modelLibrary
   * @param {import("src/game/GameContracts.js").StoreContract} options.heroConfigurationStore
   * @param {(key: string, values?: {[key: string]: string|number}) => string} options.translate
   * @param {() => Hero|null} options.getHero
   * @param {() => pc.Entity} options.getMapRoot
   * @param {() => {position: pc.Vec3, rotation?: pc.Quat}|null} options.getDropPlacement
   */
  constructor({
    pc,
    app,
    modelLibrary,
    heroConfigurationStore,
    translate,
    getHero,
    getMapRoot,
    getDropPlacement = null,
  }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {GameModelLibrary}
     */
    this.#modelLibrary = modelLibrary;
    /**
     *
     * @type {import("src/game/GameContracts.js").StoreContract}
     */
    this.#heroConfigurationStore = heroConfigurationStore;
    /**
     *
     * @type {() => Hero|null}
     */
    this.#getHero = getHero;
    /**
     *
     * @type {() => pc.Entity}
     */
    this.#getMapRoot = getMapRoot;
    /**
     *
     * @type {() => {position: pc.Vec3, rotation?: pc.Quat}|null}
     */
    this.#getDropPlacement = getDropPlacement;
    /**
     *
     * @type {InventoryHud}
     */
    this.#hud = new InventoryHud({
      pc,
      app,
      modelLibrary,
      translate,
      /**
       *
       * @param {number} fromSlot
       * @param {number} toSlot
       */
      onMoveItem: (fromSlot, toSlot) => this.moveItem(fromSlot, toSlot),
      /**
       *
       * @param {number} slot
       * @param {number} clientX
       * @param {number} clientY
       * @param {number} heightClientX
       * @param {number} heightClientY
       */
      onDropItem: (slot, clientX, clientY, heightClientX, heightClientY) =>
        this.dropItem(slot, clientX, clientY, heightClientX, heightClientY),
    });
    this.#hud.attach();
    this.#hud.visible = Boolean(this.#heroConfigurationStore.inventory.visible);
  }

  /**
   *
   * @returns {Array}
   */
  static get modelUrls() {
    return [InventoryHud.modelUrl];
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraState}
   */
  get state() {
    const hero = this.#getHero();
    return {
      ...(hero?.inventory ?? {
        capacity: Hero.inventoryCapacity,
        items: [],
      }),
      visible: this.visible,
    };
  }

  /**
   *
   * @returns {boolean}
   */
  get visible() {
    return this.#hud?.visible ?? false;
  }

  set visible(visible) {
    this.setVisible(visible);
  }

  /**
   *
   * @returns {boolean}
   */
  get fullReactionVisible() {
    return this.#hud?.fullReactionVisible ?? false;
  }

  /**
   *
   * @returns {number}
   */
  get thrownItemCount() {
    return this.#thrownItems.length;
  }

  /**
   *
   * @returns {Array}
   */
  get thrownItemStates() {
    return this.#thrownItems.map(/**
     *
     * @param {import("src/game/GameContracts.js").GameObjectContract} item
     */
    (item) => item.state);
  }

  /**
   *
   * @returns {Array}
   */
  get grassImpressionContacts() {
    return this.#thrownItems.flatMap(/**
     *
     * @param {import("src/game/GameContracts.js").GameObjectContract} item
     */
    (item) => item.grassImpressionContacts);
  }

  /**
   *
   * @param {boolean} visible
   */
  setVisible(visible) {
    const nextVisible = Boolean(visible);
    if (this.#hud) {
      this.#hud.visible = nextVisible;
    }
    this.#heroConfigurationStore.setInventoryVisible(nextVisible);
    if (!nextVisible) {
      this.fadeThrownItems();
    }
  }

  syncConfiguredVisibility() {
    if (!this.#hud || !this.#heroConfigurationStore) {
      return null;
    }
    const configuredVisibility = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    if (this.#hud.visible === configuredVisibility) {
      return null;
    }
    this.#hud.visible = configuredVisibility;
    if (!configuredVisibility) {
      this.fadeThrownItems();
    }
    return configuredVisibility;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  setInventory(state) {
    this.#hud?.setInventory(state);
  }

  /**
   *
   * @param {pc.Vec3} position
   */
  showFullReaction(position) {
    this.#hud?.showFullReaction(position);
  }

  /**
   *
   * @param {number} deltaTime
   * @param {pc.Vec3} fullIndicatorPosition
   */
  update(deltaTime, fullIndicatorPosition) {
    this.#hud?.update(deltaTime, fullIndicatorPosition);
    this.#updateThrownItems(deltaTime);
  }

  /**
   *
   * @param {number} fromSlot
   * @param {number} toSlot
   */
  moveItem(fromSlot, toSlot) {
    const moved = this.#heroConfigurationStore.moveInventoryItem(
      fromSlot,
      toSlot,
    );
    if (moved) {
      this.setInventory(this.state);
    }
    return moved;
  }

  /**
   *
   * @param {number} slot
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} heightClientX
   * @param {number} heightClientY
   */
  dropItem(slot, clientX, clientY, heightClientX, heightClientY) {
    const inventoryItem = this.#heroConfigurationStore.inventory.items.find(
      /**
       *
       * @param {import("src/game/GameContracts.js").GameObjectContract} item
       */
      (item) => item.slot === slot,
    );
    const hero = this.#getHero();
    const mapRoot = this.#getMapRoot();
    if (!inventoryItem?.modelUrl || !hero || !mapRoot) {
      return null;
    }
    const placement =
      this.#getDropPlacement?.(
        clientX,
        clientY,
        heightClientX,
        heightClientY,
      ) ?? null;
    const position = placement?.position ?? hero.position;
    const direction = placement?.direction ?? hero.facingDirection;
    const dropStartY = placement?.dropStartY ?? null;
    const thrownItem = new ThrownInventoryItem({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      item: inventoryItem,
      position,
      direction,
      dropped: true,
      dropStartY,
    });
    const droppedItem = this.#heroConfigurationStore.dropInventoryItem(slot);
    if (!droppedItem) {
      thrownItem.destroy();
      return null;
    }
    mapRoot.addChild(thrownItem.entity);
    this.#thrownItems.push(thrownItem);
    this.setInventory(this.state);
    return droppedItem;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerDown(clientX, clientY) {
    return this.#hud?.pointerDown(clientX, clientY) ?? false;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerMove(clientX, clientY) {
    return this.#hud?.pointerMove(clientX, clientY) ?? false;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerUp(clientX, clientY) {
    return this.#hud?.pointerUp(clientX, clientY) ?? false;
  }

  pointerLeave() {
    this.#hud?.pointerLeave();
  }

  cancelPointer() {
    this.#hud?.cancelPointer();
  }

  fadeThrownItems() {
    for (const thrownItem of this.#thrownItems) {
      thrownItem.beginFade();
    }
  }

  clearWorldItems() {
    for (const thrownItem of this.#thrownItems) {
      thrownItem.destroy();
    }
    this.#thrownItems = [];
  }

  destroy() {
    this.clearWorldItems();
    this.#hud?.destroy();
    this.#hud = null;
    this.#modelLibrary = null;
    this.#heroConfigurationStore = null;
    this.#getHero = null;
    this.#getMapRoot = null;
    this.#getDropPlacement = null;
  }

  /**
   *
   * @param {number} deltaTime
   */
  #updateThrownItems(deltaTime) {
    const remainingItems = [];
    for (const thrownItem of this.#thrownItems) {
      thrownItem.advance(deltaTime);
      if (thrownItem.expired) {
        thrownItem.destroy();
      } else {
        remainingItems.push(thrownItem);
      }
    }
    this.#thrownItems = remainingItems;
  }
}
