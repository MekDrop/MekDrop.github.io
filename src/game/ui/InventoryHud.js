import {
  InventoryPanelPainter,
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PANEL_TEXTURE_SCALE,
  SLOT_COLUMNS,
  SLOT_ROWS,
  SLOT_SIZE,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
  CLOSE_BUTTON_SIZE,
} from "./InventoryPanelPainter.js";
import { inventoryMushroomPart } from "../objects/ground-cover/MushroomParts.js";
import { Vec2 } from "playcanvas";
import { InventoryItemProjector } from "./InventoryItemProjector.js";
import { gameUiTheme } from "./GameUiTheme.js";
import { InventoryFullReactionHud } from "./InventoryFullReactionHud.js";

/**
 * @typedef {{id: string, variant: string, category: number, labelKey: string, icon: string, modelUrl: string, slot: number}} InventoryItem
 */

/**
 * @typedef {{capacity: number, items: InventoryItem[]}} InventoryState
 */

/**
 * @typedef {{canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: import("playcanvas").Texture}} TextureRecord
 */

/**
 * @typedef {{entity: import("playcanvas").Entity, ownedTexture: import("playcanvas").Texture|null}} ItemVisual
 */

/**
 * @typedef {{bounds: DOMRect, scale: number}} CanvasMetrics
 */

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const ITEM_PROJECTION_SIZE = 64;

export class InventoryHud {
  /**
   * @type {typeof import("playcanvas")|null}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application|null}
   */
  #app;
  /**
   * @type {((key: string) => string)|null}
   */
  #translate;
  /**
   * @type {InventoryPanelPainter}
   */
  #painter;
  /**
   * @type {((sourceSlot: number, targetSlot: number) => boolean)|null}
   */
  #onMoveItem;
  /**
   * @type {((sourceSlot: number, dropX: number, dropY: number, clientX: number, clientY: number) => boolean)|null}
   */
  #onDropItem;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #modalRoot;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #panel;
  /**
   * @type {TextureRecord|null}
   */
  #panelTexture;
  /**
   * @type {InventoryItemProjector|null}
   */
  #itemProjector;
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #itemProjectionEntities = [];
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #tooltip;
  /**
   * @type {TextureRecord|null}
   */
  #tooltipTexture;
  /**
   * @type {TextureRecord|null}
   */
  #closeTexture;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #closeButton;
  /**
   * @type {InventoryFullReactionHud|null}
   */
  #fullReaction;
  /**
   * @type {boolean}
   */
  #closeHovered = false;
  /**
   * @type {boolean}
   */
  #closePressed = false;
  /**
   * @type {boolean}
   */
  #closeArmed = false;
  /**
   * @type {number|null}
   */
  #hoveredItemSlot = null;
  /**
   * @type {number|null}
   */
  #draggedItemSlot = null;
  /**
   * @type {number|null}
   */
  #dragHoveredSlot = null;
  /**
   * @type {ItemVisual|null}
   */
  #dragVisual = null;
  /**
   * @type {Vec2|null}
   */
  #dragStartClient = null;
  /**
   * @type {InventoryState}
   */
  #state = {
    capacity: SLOT_COLUMNS * SLOT_ROWS,
    items: [],
  };

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../models/GameModelLibrary.js").GameModelLibrary, translate?: (key: string) => string, onMoveItem?: ((sourceSlot: number, targetSlot: number) => boolean)|null, onDropItem?: ((sourceSlot: number, dropX: number, dropY: number, clientX: number, clientY: number) => boolean)|null}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {(key: string) => string} options.translate
   * @param {((sourceSlot: number, targetSlot: number) => boolean)|null} options.onMoveItem
   * @param {((sourceSlot: number, dropX: number, dropY: number, clientX: number, clientY: number) => boolean)|null} options.onDropItem
   */
  constructor({
    pc,
    app,
    modelLibrary,
    /**
     *
     * @param {string} key
     */
    translate = (key) => key,
    onMoveItem = null,
    onDropItem = null,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#translate = translate;
    this.#painter = new InventoryPanelPainter(translate);
    this.#onMoveItem = onMoveItem;
    this.#onDropItem = onDropItem;
    this.#itemProjector = new InventoryItemProjector({
      pc,
      app,
      modelLibrary,
    });
    this.#entity = new pc.Entity("Inventory HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 108,
    });
    this.#build();
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return InventoryFullReactionHud.modelUrl;
  }

  /**
   * @returns {boolean}
   */
  get visible() {
    return Boolean(this.#modalRoot?.enabled);
  }

  /**
   * @returns {boolean}
   */
  get fullReactionVisible() {
    return this.#fullReaction?.visible ?? false;
  }

  set visible(visible) {
    const nextVisible = Boolean(visible);
    if (this.#modalRoot) {
      this.#modalRoot.enabled = nextVisible;
    }
    if (nextVisible) {
      this.#updateCursor();
    } else {
      this.cancelPointer();
      this.#setCursor("");
    }
  }

  /**
   *
   * @param {import("playcanvas").Entity} parent
   */
  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) {
      return;
    }
    parent.addChild(this.#entity);
  }

  toggle() {
    this.visible = !this.visible;

    return this.visible;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  closeButtonContains(clientX, clientY) {
    const canvas = this.#app.graphicsDevice.canvas;
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.sqrt(
      (bounds.width / REFERENCE_WIDTH) *
        (bounds.height / REFERENCE_HEIGHT),
    );
    const centerX =
      bounds.left +
      bounds.width / 2 +
      (PANEL_WIDTH / 2 - 18 - CLOSE_BUTTON_SIZE / 2) * scale;
    const centerY =
      bounds.top +
      bounds.height / 2 -
      (PANEL_HEIGHT / 2 - 18 - CLOSE_BUTTON_SIZE / 2) * scale;
    const hitRadius = Math.max(18, CLOSE_BUTTON_SIZE * scale * 0.75);

    return (
      Math.abs(clientX - centerX) <= hitRadius &&
      Math.abs(clientY - centerY) <= hitRadius
    );
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerDown(clientX, clientY) {
    const closeHovered = this.closeButtonContains(clientX, clientY);
    this.#closeArmed = closeHovered;
    this.#setCloseButtonState(closeHovered, closeHovered);
    if (closeHovered) {
      return true;
    }

    const itemSlot = this.#slotIndexAt(clientX, clientY, true);
    if (itemSlot === null) {
      return false;
    }
    this.#beginItemDrag(itemSlot, clientX, clientY);

    return true;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerMove(clientX, clientY) {
    if (this.#draggedItemSlot !== null) {
      this.#dragHoveredSlot = this.#slotIndexAt(clientX, clientY);
      this.#positionItemVisual(this.#dragVisual, clientX, clientY);
      this.#setHoveredItem(null);
      this.#setCloseButtonState(false, false);
      this.#drawPanel();
      this.#updateCursor();

      return true;
    }

    const hovered = this.closeButtonContains(clientX, clientY);
    this.#setHoveredItem(this.#slotIndexAt(clientX, clientY, true));
    this.#setCloseButtonState(
      hovered,
      this.#closeArmed && hovered,
    );

    return hovered || this.#hoveredItemSlot !== null;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pointerUp(clientX, clientY) {
    if (this.#draggedItemSlot !== null) {
      this.#finishItemDrag(clientX, clientY);

      return false;
    }
    const activate =
      this.#closeArmed && this.closeButtonContains(clientX, clientY);
    this.#closeArmed = false;
    this.#setCloseButtonState(activate, false);

    return activate;
  }

  pointerLeave() {
    if (this.#draggedItemSlot !== null) {
      this.#dragHoveredSlot = null;
      this.#drawPanel();

      return;
    }
    this.#setHoveredItem(null);
    this.#setCloseButtonState(false, false);
  }

  cancelPointer() {
    this.#closeArmed = false;
    this.#cancelItemDrag();
    this.#setHoveredItem(null);
    this.#setCloseButtonState(false, false);
  }

  /**
   *
   * @param {InventoryState} state
   */
  setInventory(state) {
    const occupiedSlots = new Set();
    this.#state = {
      capacity: state.capacity,
      items: state.items.map(/**
       *
       * @param {InventoryItem} item
       */
        (item) => {
          let slot = item.slot;
          if (
            !Number.isInteger(slot) ||
          slot < 0 ||
          slot >= state.capacity ||
          occupiedSlots.has(slot)
          ) {
            slot = 0;
            while (occupiedSlots.has(slot) && slot < state.capacity) {
              slot += 1;
            }
          }
          occupiedSlots.add(slot);

          return {
            ...item,
            slot,
          };
        }),
    };
    if (
      this.#draggedItemSlot !== null &&
      !this.#itemAtSlot(this.#draggedItemSlot)
    ) {
      this.#cancelItemDrag();
    }
    this.#syncItemProjections();
    this.#drawPanel();
  }

  /**
   * @param {Vec2|import("playcanvas").Vec3|null} screenPosition
   */
  showFullReaction(screenPosition = null) {
    if (this.#state.items.length < this.#state.capacity) {
      return false;
    }
    return this.#fullReaction?.show(screenPosition) ?? false;
  }

  /**
   * @param {number} deltaTime
   * @param {Vec2|import("playcanvas").Vec3|null} screenPosition
   */
  update(deltaTime, screenPosition = null) {
    this.#fullReaction?.update(deltaTime, screenPosition);
  }

  destroy() {
    this.#destroyItemVisual(this.#dragVisual);
    this.#fullReaction?.destroy();
    this.#entity?.destroy();
    this.#panelTexture?.texture.destroy();
    this.#tooltipTexture?.texture.destroy();
    this.#closeTexture?.texture.destroy();
    this.#itemProjector?.destroy();
    this.#setCursor("");
    this.#entity = null;
    this.#modalRoot = null;
    this.#panel = null;
    this.#panelTexture = null;
    this.#itemProjector = null;
    this.#itemProjectionEntities = [];
    this.#tooltip = null;
    this.#tooltipTexture = null;
    this.#closeTexture = null;
    this.#closeButton = null;
    this.#fullReaction = null;
    this.#hoveredItemSlot = null;
    this.#dragVisual = null;
    this.#dragStartClient = null;
    this.#onMoveItem = null;
    this.#onDropItem = null;
    this.#app = null;
    this.#pc = null;
  }

  #build() {
    this.#modalRoot = new this.#pc.Entity("Inventory modal");
    this.#modalRoot.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0, 0, 1, 1),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      margin: new this.#pc.Vec4(0, 0, 0, 0),
      useInput: false,
    });
    this.#entity.addChild(this.#modalRoot);
    this.#createDimmer();
    this.#createPanel();
    this.#fullReaction = new InventoryFullReactionHud({
      pc: this.#pc,
      app: this.#app,
      itemProjector: this.#itemProjector,
      parent: this.#entity,
    });
    this.#modalRoot.enabled = false;
    this.#entity.screen.syncDrawOrder();
  }

  #createDimmer() {
    const dimmer = new this.#pc.Entity("Inventory dimmer");
    dimmer.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 0, 1, 1),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      margin: new this.#pc.Vec4(0, 0, 0, 0),
      color: gameUiTheme.playCanvasColor(this.#pc, gameUiTheme.backdrop),
      opacity: 0.7,
      useInput: false,
    });
    this.#modalRoot.addChild(dimmer);
  }

  #createPanel() {
    const canvas = document.createElement("canvas");
    canvas.width = PANEL_WIDTH * PANEL_TEXTURE_SCALE;
    canvas.height = PANEL_HEIGHT * PANEL_TEXTURE_SCALE;
    this.#panelTexture = {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.#createTexture("Inventory panel texture", canvas),
    };

    this.#panel = new this.#pc.Entity("Inventory panel");
    this.#panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0.5, 0.5, 0.5),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      useInput: false,
    });
    this.#panel.element.texture = this.#panelTexture.texture;
    this.#modalRoot.addChild(this.#panel);
    this.#createItemProjections();
    this.#createTooltip();
    this.#createCloseButton(this.#panel);
    this.#syncItemProjections();
    this.#drawPanel();
  }

  #createItemProjections() {
    for (let index = 0; index < SLOT_COLUMNS * SLOT_ROWS; index += 1) {
      const column = index % SLOT_COLUMNS;
      const row = Math.floor(index / SLOT_COLUMNS);
      const slotX =
        this.#slotLeft + column * (SLOT_SIZE + gameUiTheme.spaceSm);
      const slotY = 98 + row * (SLOT_SIZE + gameUiTheme.spaceSm);
      const projection = new this.#pc.Entity(
        `Inventory item projection ${index + 1}`,
      );
      projection.addComponent("element", {
        type: this.#pc.ELEMENTTYPE_IMAGE,
        anchor: new this.#pc.Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new this.#pc.Vec2(0.5, 0.5),
        width: ITEM_PROJECTION_SIZE,
        height: ITEM_PROJECTION_SIZE,
        useInput: false,
      });
      projection.setLocalPosition(
        slotX + SLOT_SIZE / 2 - PANEL_WIDTH / 2,
        PANEL_HEIGHT / 2 - (slotY + 34),
        0,
      );
      projection.enabled = false;
      this.#panel.addChild(projection);
      this.#itemProjectionEntities.push(projection);
    }
  }

  #createTooltip() {
    const canvas = document.createElement("canvas");
    canvas.width = TOOLTIP_WIDTH * PANEL_TEXTURE_SCALE;
    canvas.height = TOOLTIP_HEIGHT * PANEL_TEXTURE_SCALE;
    this.#tooltipTexture = {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.#createTexture("Inventory item tooltip texture", canvas),
    };
    this.#tooltip = new this.#pc.Entity("Inventory item tooltip");
    this.#tooltip.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0.5, 0.5, 0.5),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: TOOLTIP_WIDTH,
      height: TOOLTIP_HEIGHT,
      useInput: false,
    });
    this.#tooltip.element.texture = this.#tooltipTexture.texture;
    this.#tooltip.enabled = false;
    this.#panel.addChild(this.#tooltip);
  }

  /**
   *
   * @param {import("playcanvas").Entity} panel
   */
  #createCloseButton(panel) {
    const canvas = document.createElement("canvas");
    canvas.width = CLOSE_BUTTON_SIZE * PANEL_TEXTURE_SCALE;
    canvas.height = CLOSE_BUTTON_SIZE * PANEL_TEXTURE_SCALE;
    this.#closeTexture = {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.#createTexture("Inventory close button texture", canvas),
    };

    this.#closeButton = new this.#pc.Entity("Inventory close button");
    this.#closeButton.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(1, 1, 1, 1),
      pivot: new this.#pc.Vec2(1, 1),
      width: CLOSE_BUTTON_SIZE,
      height: CLOSE_BUTTON_SIZE,
      useInput: false,
    });
    this.#closeButton.element.texture = this.#closeTexture.texture;
    this.#closeButton.setLocalPosition(-18, -18, 0);
    panel.addChild(this.#closeButton);
    this.#drawCloseButton();
  }

  /**
   *
   * @param {boolean} hovered
   * @param {boolean} pressed
   */
  #setCloseButtonState(hovered, pressed) {
    const nextHovered = Boolean(hovered);
    const nextPressed = Boolean(pressed);
    if (
      nextHovered === this.#closeHovered &&
      nextPressed === this.#closePressed
    ) {
      return;
    }
    this.#closeHovered = nextHovered;
    this.#closePressed = nextPressed;
    this.#updateCursor();
    this.#drawCloseButton();
  }

  #drawCloseButton() {
    if (!this.#closeTexture || !this.#closeButton) {
      return;
    }
    this.#painter.drawCloseButton(
      this.#closeTexture,
      this.#closeHovered,
      this.#closePressed,
    );
    const { canvas, texture } = this.#closeTexture;
    texture.setSource(canvas);
    this.#closeButton.setLocalScale(1, 1, 1);
  }

  /**
   *
   * @param {string} cursor
   */
  #setCursor(cursor) {
    const canvas = this.#app?.graphicsDevice?.canvas;
    if (canvas) {
      canvas.style.cursor = cursor;
    }
  }

  #updateCursor() {
    if (!this.visible) {
      this.#setCursor("");

      return;
    }
    if (this.#draggedItemSlot !== null) {
      this.#setCursor("grabbing");

      return;
    }
    if (this.#closeHovered) {
      this.#setCursor("pointer");

      return;
    }
    this.#setCursor(this.#hoveredItemSlot === null ? "default" : "grab");
  }

  #drawPanel() {
    if (!this.#panelTexture) {
      return;
    }
    this.#painter.drawPanel(
      this.#panelTexture,
      this.#state,
      this.#draggedItemSlot,
      this.#dragHoveredSlot,
    );
    const { canvas, texture } = this.#panelTexture;
    texture.setSource(canvas);
  }

  #drawItemTooltip() {
    const item = this.#itemAtSlot(this.#hoveredItemSlot);
    if (!item || !this.#tooltipTexture || !this.#tooltip) {
      if (this.#tooltip) {
        this.#tooltip.enabled = false;
      }
      return;
    }
    const label = this.#translate(item.labelKey);
    const { canvas, texture } = this.#tooltipTexture;
    if (!this.#painter.drawTooltip(this.#tooltipTexture, label)) {
      this.#tooltip.enabled = false;

      return;
    }

    const column = this.#hoveredItemSlot % SLOT_COLUMNS;
    const row = Math.floor(this.#hoveredItemSlot / SLOT_COLUMNS);
    const slotLeft =
      this.#slotLeft + column * (SLOT_SIZE + gameUiTheme.spaceSm);
    const slotTop = 98 + row * (SLOT_SIZE + gameUiTheme.spaceSm);
    const centerX = Math.max(
      TOOLTIP_WIDTH / 2 + gameUiTheme.spaceSm,
      Math.min(
        PANEL_WIDTH - TOOLTIP_WIDTH / 2 - gameUiTheme.spaceSm,
        slotLeft + SLOT_SIZE / 2,
      ),
    );
    const centerY =
      row === 0
        ? slotTop + SLOT_SIZE + gameUiTheme.spaceXs + TOOLTIP_HEIGHT / 2
        : slotTop - gameUiTheme.spaceXs - TOOLTIP_HEIGHT / 2;

    texture.setSource(canvas);
    this.#tooltip.setLocalPosition(
      centerX - PANEL_WIDTH / 2,
      PANEL_HEIGHT / 2 - centerY,
      0,
    );
    this.#tooltip.enabled = true;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {boolean} occupiedOnly
   */
  #slotIndexAt(clientX, clientY, occupiedOnly = false) {
    if (!this.visible || !this.#panelTexture) {
      return null;
    }
    const { x: panelX, y: panelY } = this.#clientToPanel(clientX, clientY);
    for (let index = 0; index < this.#state.capacity; index += 1) {
      const column = index % SLOT_COLUMNS;
      const row = Math.floor(index / SLOT_COLUMNS);
      const x =
        this.#slotLeft + column * (SLOT_SIZE + gameUiTheme.spaceSm);
      const y = 98 + row * (SLOT_SIZE + gameUiTheme.spaceSm);
      if (
        panelX < x ||
        panelX > x + SLOT_SIZE ||
        panelY < y ||
        panelY > y + SLOT_SIZE
      ) {
        continue;
      }
      return occupiedOnly && !this.#itemAtSlot(index) ? null : index;
    }

    return null;
  }

  /**
   *
   * @param {number} slot
   */
  #setHoveredItem(slot) {
    if (slot === this.#hoveredItemSlot) {
      return;
    }
    this.#hoveredItemSlot = slot;
    this.#drawItemTooltip();
    this.#updateCursor();
  }

  #syncItemProjections() {
    for (const [slot, projection] of this.#itemProjectionEntities.entries()) {
      const item = this.#itemAtSlot(slot);
      const texture = item
        ? this.#itemProjector.textureFor(item.modelUrl, inventoryMushroomPart(item))
        : null;
      projection.element.texture = texture;
      projection.enabled =
        Boolean(texture) && slot !== this.#draggedItemSlot;
    }
  }

  /**
   *
   * @param {number} slot
   * @param {number} clientX
   * @param {number} clientY
   */
  #beginItemDrag(slot, clientX, clientY) {
    const item = this.#itemAtSlot(slot);
    if (!item) {
      return;
    }
    this.#draggedItemSlot = slot;
    this.#dragHoveredSlot = slot;
    this.#dragStartClient = new Vec2(clientX, clientY);
    this.#setHoveredItem(null);
    this.#dragVisual = this.#createItemVisual(item, "Dragged inventory item");
    this.#modalRoot.addChild(this.#dragVisual.entity);
    this.#positionItemVisual(this.#dragVisual, clientX, clientY);
    this.#syncItemProjections();
    this.#drawPanel();
    this.#entity.screen.syncDrawOrder();
    this.#updateCursor();
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  #finishItemDrag(clientX, clientY) {
    const sourceSlot = this.#draggedItemSlot;
    const targetSlot = this.#slotIndexAt(clientX, clientY);
    const validTarget =
      targetSlot !== null &&
      targetSlot !== sourceSlot &&
      !this.#itemAtSlot(targetSlot);
    const droppedOutside = !this.#dialogContains(clientX, clientY);
    const visual = this.#dragVisual;

    this.#dragVisual = null;
    this.#draggedItemSlot = null;
    this.#dragHoveredSlot = null;
    this.#dragStartClient = null;

    if (validTarget && this.#onMoveItem?.(sourceSlot, targetSlot)) {
      this.#destroyItemVisual(visual);
    } else if (
      droppedOutside &&
      this.#onDropItem?.(
        sourceSlot,
        clientX,
        clientY,
        clientX,
        clientY,
      )
    ) {
      this.#destroyItemVisual(visual);
    } else {
      this.#destroyItemVisual(visual);
    }

    this.#syncItemProjections();
    this.#drawPanel();
    this.#updateCursor();
  }

  #cancelItemDrag() {
    if (this.#draggedItemSlot === null && !this.#dragVisual) {
      return;
    }
    this.#destroyItemVisual(this.#dragVisual);
    this.#dragVisual = null;
    this.#draggedItemSlot = null;
    this.#dragHoveredSlot = null;
    this.#dragStartClient = null;
    this.#syncItemProjections();
    this.#drawPanel();
    this.#updateCursor();
  }

  /**
   *
   * @param {InventoryItem} item
   * @param {string} name
   */
  #createItemVisual(item, name) {
    let texture = this.#itemProjector.textureFor(item.modelUrl, inventoryMushroomPart(item));
    let ownedTexture = null;
    if (!texture) {
      const canvas = document.createElement("canvas");
      canvas.width = ITEM_PROJECTION_SIZE * PANEL_TEXTURE_SCALE;
      canvas.height = ITEM_PROJECTION_SIZE * PANEL_TEXTURE_SCALE;
      const context = canvas.getContext("2d");
      context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = '44px "Segoe UI Emoji", sans-serif';
      context.fillStyle = gameUiTheme.text;
      context.fillText(
        item.icon ?? "?",
        ITEM_PROJECTION_SIZE / 2,
        ITEM_PROJECTION_SIZE / 2,
      );
      texture = this.#createTexture(`${name} texture`, canvas);
      ownedTexture = texture;
    }

    const entity = new this.#pc.Entity(name);
    entity.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0.5, 0.5, 0.5),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      width: ITEM_PROJECTION_SIZE,
      height: ITEM_PROJECTION_SIZE,
      opacity: 0.92,
      useInput: false,
    });
    entity.element.texture = texture;

    return {
      entity,
      ownedTexture,
    };
  }

  /**
   *
   * @param {ItemVisual|null} visual
   * @param {number} clientX
   * @param {number} clientY
   */
  #positionItemVisual(visual, clientX, clientY) {
    if (!visual) {
      return;
    }
    const { bounds, scale } = this.#canvasMetrics;
    visual.entity.setLocalPosition(
      (clientX - (bounds.left + bounds.width / 2)) / scale,
      (bounds.top + bounds.height / 2 - clientY) / scale,
      0,
    );
  }

  /**
   *
   * @param {ItemVisual|null} visual
   */
  #destroyItemVisual(visual) {
    if (!visual) {
      return;
    }
    visual.entity.destroy();
    visual.ownedTexture?.destroy();
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  #dialogContains(clientX, clientY) {
    const { x, y } = this.#clientToPanel(clientX, clientY);

    return x >= 0 && x <= PANEL_WIDTH && y >= 0 && y <= PANEL_HEIGHT;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  #clientToPanel(clientX, clientY) {
    const { bounds, scale } = this.#canvasMetrics;

    return new Vec2(
      (clientX - (bounds.left + bounds.width / 2)) / scale +
        PANEL_WIDTH / 2,
      (clientY - (bounds.top + bounds.height / 2)) / scale +
        PANEL_HEIGHT / 2,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   */
  #panelToClient(x, y) {
    const { bounds, scale } = this.#canvasMetrics;

    return {
      clientX: bounds.left + bounds.width / 2 + (x - PANEL_WIDTH / 2) * scale,
      clientY: bounds.top + bounds.height / 2 + (y - PANEL_HEIGHT / 2) * scale,
    };
  }

  /**
   * @returns {CanvasMetrics}
   */
  get #canvasMetrics() {
    const canvas = this.#app.graphicsDevice.canvas;
    const bounds = canvas.getBoundingClientRect();

    return {
      bounds,
      scale: Math.sqrt(
        (bounds.width / REFERENCE_WIDTH) *
          (bounds.height / REFERENCE_HEIGHT),
      ),
    };
  }

  /**
   *
   * @param {number} slot
   */
  #itemAtSlot(slot) {
    if (!Number.isInteger(slot)) {
      return null;
    }
    return this.#state.items.find(/**
     *
     * @param {InventoryItem} item
     */
      (item) => item.slot === slot) ?? null;
  }

  /**
   * @returns {number}
   */
  get #slotLeft() {
    return (
      (PANEL_WIDTH -
        SLOT_COLUMNS * SLOT_SIZE -
        (SLOT_COLUMNS - 1) * gameUiTheme.spaceSm) /
      2
    );
  }

  /**
   *
   * @param {string} name
   * @param {HTMLCanvasElement} canvas
   */
  #createTexture(name, canvas) {
    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      width: canvas.width,
      height: canvas.height,
      format: this.#pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps: false,
      minFilter: this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.name = name;
    texture.setSource(canvas);

    return texture;
  }

}
