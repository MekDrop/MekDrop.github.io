import { Hero } from "../../objects/hero/index.js";
import { ThrownInventoryItem } from "../../objects/inventory/index.js";
import { InventoryHud } from "../../ui/index.js";

export class InventoryScene {
  #hud = null;
  #pc;
  #modelLibrary;
  #heroConfigurationStore;
  #getHero;
  #getMapRoot;
  #getDropPlacement;
  #thrownItems = [];

  constructor({
    pc,
    app,
    modelLibrary,
    heroConfigurationStore,
    translate,
    theme,
    getHero,
    getMapRoot,
    getDropPlacement = null,
  }) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#getHero = getHero;
    this.#getMapRoot = getMapRoot;
    this.#getDropPlacement = getDropPlacement;
    this.#hud = new InventoryHud({
      pc,
      app,
      modelLibrary,
      translate,
      theme,
      onMoveItem: (fromSlot, toSlot) => this.moveItem(fromSlot, toSlot),
      onDropItem: (slot, clientX, clientY, heightClientX, heightClientY) =>
        this.dropItem(slot, clientX, clientY, heightClientX, heightClientY),
    });
    this.#hud.attach();
    this.#hud.visible = Boolean(this.#heroConfigurationStore.inventory.visible);
  }

  static get modelUrls() {
    return [InventoryHud.modelUrl];
  }

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

  get visible() {
    return this.#hud?.visible ?? false;
  }

  set visible(visible) {
    this.setVisible(visible);
  }

  get fullReactionVisible() {
    return this.#hud?.fullReactionVisible ?? false;
  }

  get thrownItemCount() {
    return this.#thrownItems.length;
  }

  get thrownItemStates() {
    return this.#thrownItems.map((item) => item.state);
  }

  get grassImpressionContacts() {
    return this.#thrownItems.flatMap((item) => item.grassImpressionContacts);
  }

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

  setInventory(state) {
    this.#hud?.setInventory(state);
  }

  showFullReaction(position) {
    this.#hud?.showFullReaction(position);
  }

  update(deltaTime, fullIndicatorPosition) {
    this.#hud?.update(deltaTime, fullIndicatorPosition);
    this.#updateThrownItems(deltaTime);
  }

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

  dropItem(slot, clientX, clientY, heightClientX, heightClientY) {
    const inventoryItem = this.#heroConfigurationStore.inventory.items.find(
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

  pointerDown(clientX, clientY) {
    return this.#hud?.pointerDown(clientX, clientY) ?? false;
  }

  pointerMove(clientX, clientY) {
    return this.#hud?.pointerMove(clientX, clientY) ?? false;
  }

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
