import { Hero } from "../../objects/characters/hero/index.js";
import { ThrownInventoryItem } from "../../objects/inventory/index.js";
import { InventoryHud } from "../../ui/index.js";

const INVENTORY_DROP_MIN_FALL_HEIGHT = 0.35;
const INVENTORY_DROP_MAX_FALL_HEIGHT = 12;

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
   * @type {pc.Application|null}
   */
  #app;
  /**
   * @type {HTMLCanvasElement|null}
   */
  #canvas;
  /**
   * @type {(event: import("../../GameContracts.js").CameraPointer) => import("../../objects/shared/ScenePointerInteraction.js").ScenePointerRay|null}
   */
  #pointerRay;
  /**
   * @type {() => import("../../camera/GameCamera.js").GameCamera|null}
   */
  #getCamera;
  /**
   * @type {number}
   */
  #cameraPitch;
  /**
   *
   * @type {Array}
   */
  #thrownItems = [];

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, modelLibrary: GameModelLibrary, heroConfigurationStore: import("src/game/GameContracts.js").StoreContract, translate: (key: string, values?: {[key: string]: string|number}) => string, getHero: () => Hero|null, getMapRoot: () => pc.Entity, canvas: HTMLCanvasElement, pointerRay: (event: import("../../GameContracts.js").CameraPointer) => import("../../objects/shared/ScenePointerInteraction.js").ScenePointerRay|null, getCamera: () => import("../../camera/GameCamera.js").GameCamera|null, cameraPitch: number}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameModelLibrary} options.modelLibrary
   * @param {import("src/game/GameContracts.js").StoreContract} options.heroConfigurationStore
   * @param {(key: string, values?: {[key: string]: string|number}) => string} options.translate
   * @param {() => Hero|null} options.getHero
   * @param {() => pc.Entity} options.getMapRoot
   * @param {HTMLCanvasElement} options.canvas
   * @param {(event: import("../../GameContracts.js").CameraPointer) => import("../../objects/shared/ScenePointerInteraction.js").ScenePointerRay|null} options.pointerRay
   * @param {() => import("../../camera/GameCamera.js").GameCamera|null} options.getCamera
   * @param {number} options.cameraPitch
   */
  constructor({
    pc,
    app,
    modelLibrary,
    heroConfigurationStore,
    translate,
    getHero,
    getMapRoot,
    canvas,
    pointerRay,
    getCamera,
    cameraPitch,
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
    this.#app = app;
    this.#canvas = canvas;
    this.#pointerRay = pointerRay;
    this.#getCamera = getCamera;
    this.#cameraPitch = cameraPitch;
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
      onMoveItem: this.#onMoveItem.bind(this),
      /**
       *
       * @param {number} slot
       * @param {number} clientX
       * @param {number} clientY
       * @param {number} heightClientX
       * @param {number} heightClientY
       */
      onDropItem: this.#onDropItem.bind(this),
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
    return this.#thrownItems.map(InventoryScene.#mapItem);
  }

  /**
   *
   * @returns {Array}
   */
  get grassImpressionContacts() {
    return this.#thrownItems.flatMap(InventoryScene.#flatMapItem);
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
      this.#inventoryDropPlacement(
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
    this.#app = null;
    this.#canvas = null;
    this.#pointerRay = null;
    this.#getCamera = null;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} heightClientX
   * @param {number} heightClientY
   */
  #inventoryDropPlacement(clientX, clientY, heightClientX, heightClientY) {
    const ray = this.#pointerRay({
      clientX,
      clientY,
    });
    const heightRay = this.#pointerRay({
      clientX: heightClientX ?? clientX,
      clientY: heightClientY ?? clientY,
    });
    const hero = this.#getHero();
    if (!ray || !heightRay || !hero) {
      return null;
    }
    const hit = this.#inventoryDropRaycast(heightRay);
    const position = hit?.point?.clone() ?? this.#inventoryDropPlanePosition(
      ray,
      hero.position.y,
    );
    if (!position) {
      return null;
    }
    const direction = {
      x: position.x - hero.position.x,
      z: position.z - hero.position.z,
    };
    if (Math.hypot(direction.x, direction.z) <= 0.000001) {
      return {
        position,
        direction: hero.facingDirection,
        dropStartY: this.#inventoryDropStartY(
          position,
          heightClientY ?? clientY,
        ),
      };
    }
    return {
      position,
      direction,
      dropStartY: this.#inventoryDropStartY(position, heightClientY ?? clientY),
    };
  }

  /**
   *
   * @param {import("../../objects/shared/ScenePointerInteraction.js").ScenePointerRay} ray
   */
  #inventoryDropRaycast(ray) {
    const hits =
      this.#app?.systems.rigidbody?.raycastAll?.(ray.start, ray.end, {
        sort: true,
      }) ?? [];

    return hits.find(InventoryScene.#findDropSurface) ?? null;
  }

  /**
   *
   * @param {pc.Vec3} position
   * @param {number} clientY
   */
  #inventoryDropStartY(position, clientY) {
    const camera = this.#getCamera();
    if (!camera?.camera || !this.#canvas) {
      return null;
    }
    const rect = this.#canvas.getBoundingClientRect();
    const screenPosition = camera.camera.worldToScreen(position);
    const worldPerPixel =
      (2 * camera.baseOrthoHeight) /
      Math.max(1, this.#canvas.clientHeight) /
      camera.zoom;
    const cursorY = clientY - rect.top;
    const upwardScreenDistance = screenPosition.y - cursorY;
    if (upwardScreenDistance <= 0) {
      return null;
    }
    const fallHeight =
      (upwardScreenDistance * worldPerPixel) / Math.cos(this.#cameraPitch);

    return (
      position.y +
      Math.max(
        INVENTORY_DROP_MIN_FALL_HEIGHT,
        Math.min(INVENTORY_DROP_MAX_FALL_HEIGHT, fallHeight),
      )
    );
  }

  /**
   *
   * @param {import("../../objects/shared/ScenePointerInteraction.js").ScenePointerRay} ray
   * @param {number} height
   */
  #inventoryDropPlanePosition(ray, height) {
    const rayY = ray.end.y - ray.start.y;
    if (Math.abs(rayY) <= 0.000001) {
      return null;
    }
    const distance = (height - ray.start.y) / rayY;
    if (distance < 0 || distance > 1) {
      return null;
    }
    return new this.#pc.Vec3(
      ray.start.x + (ray.end.x - ray.start.x) * distance,
      height,
      ray.start.z + (ray.end.z - ray.start.z) * distance,
    );
  }

  /**
   *
   * @param {pc.RaycastResult} hit
   */
  static #findDropSurface(hit) {
    return hit.normal?.y >= 0.35;
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

  /**
   *
   * @param {number} fromSlot
   * @param {number} toSlot
   */
  #onMoveItem(fromSlot, toSlot) {
    return this.moveItem(fromSlot, toSlot);
  }

  /**
   *
   * @param {number} slot
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} heightClientX
   * @param {number} heightClientY
   */
  #onDropItem(slot, clientX, clientY, heightClientX, heightClientY) {
    return this.dropItem(slot, clientX, clientY, heightClientX, heightClientY);
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} item
   */
  static #mapItem(item) {
    return item.state;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} item
   */
  static #flatMapItem(item) {
    return item.grassImpressionContacts;
  }
}
