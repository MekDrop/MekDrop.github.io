import { InventoryItemProjector } from "./InventoryItemProjector.js";

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_WIDTH = 430;
const PANEL_HEIGHT = 420;
const PANEL_TEXTURE_SCALE = 3;
const SLOT_COLUMNS = 4;
const SLOT_ROWS = 3;
const SLOT_GAP = 8;
const SLOT_SIZE = 90;
const CLOSE_BUTTON_SIZE = 32;
const ITEM_PROJECTION_SIZE = 64;
const ITEM_LABEL_FONT = "600 10px Arial, sans-serif";
const ITEM_LABEL_MAXIMUM_WIDTH = SLOT_SIZE - 12;
const TOOLTIP_FONT = "600 11px Arial, sans-serif";
const TOOLTIP_WIDTH = 164;
const TOOLTIP_HEIGHT = 25;

export class InventoryHud {
  #pc;
  #app;
  #translate;
  #theme;
  #onMoveItem;
  #onDropItem;
  #entity;
  #modalRoot;
  #panel;
  #panelTexture;
  #itemProjector;
  #itemProjectionEntities = [];
  #tooltip;
  #tooltipTexture;
  #closeTexture;
  #closeButton;
  #closeHovered = false;
  #closePressed = false;
  #closeArmed = false;
  #hoveredItemSlot = null;
  #draggedItemSlot = null;
  #dragHoveredSlot = null;
  #dragVisual = null;
  #state = { capacity: SLOT_COLUMNS * SLOT_ROWS, items: [] };

  constructor({
    pc,
    app,
    modelLibrary,
    translate = (key) => key,
    theme,
    onMoveItem = null,
    onDropItem = null,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#translate = translate;
    this.#theme = theme;
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

  get visible() {
    return Boolean(this.#modalRoot?.enabled);
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

  setInventory(state) {
    const occupiedSlots = new Set();
    this.#state = {
      capacity: state.capacity,
      items: state.items.map((item) => {
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
        return { ...item, slot };
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

  destroy() {
    this.#destroyItemVisual(this.#dragVisual);
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
    this.#hoveredItemSlot = null;
    this.#dragVisual = null;
    this.#onMoveItem = null;
    this.#onDropItem = null;
    this.#theme = null;
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
      color: this.#theme.playCanvasColor(this.#pc, this.#theme.backdrop),
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
      const slotX = this.#slotLeft + column * (SLOT_SIZE + SLOT_GAP);
      const slotY = 98 + row * (SLOT_SIZE + SLOT_GAP);
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
    const { canvas, context, texture } = this.#closeTexture;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    const inset = this.#closePressed ? 2 : 1;
    if (this.#closeHovered && !this.#closePressed) {
      context.shadowColor = this.#theme.withAlpha(
        this.#theme.outlineStrong,
        0.65,
      );
      context.shadowBlur = 5;
    }
    this.#roundedRect(
      context,
      inset,
      inset,
      CLOSE_BUTTON_SIZE - inset * 2,
      CLOSE_BUTTON_SIZE - inset * 2,
      6,
    );
    const gradient = context.createLinearGradient(0, 0, 0, CLOSE_BUTTON_SIZE);
    if (this.#closePressed) {
      gradient.addColorStop(0, this.#theme.surfaceInsetTop);
      gradient.addColorStop(1, this.#theme.surfaceInsetBottom);
    } else if (this.#closeHovered) {
      gradient.addColorStop(0, this.#theme.outlineStrong);
      gradient.addColorStop(1, this.#theme.surfaceRaisedTop);
    } else {
      gradient.addColorStop(0, this.#theme.surfaceRaisedTop);
      gradient.addColorStop(1, this.#theme.surfaceRaisedBottom);
    }
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = this.#closeHovered
      ? this.#theme.textMuted
      : this.#theme.outline;
    context.lineWidth = this.#closePressed ? 1.5 : 1;
    context.stroke();
    const offset = this.#closePressed ? 1 : 0;
    context.beginPath();
    context.moveTo(11 + offset, 11 + offset);
    context.lineTo(21 + offset, 21 + offset);
    context.moveTo(21 + offset, 11 + offset);
    context.lineTo(11 + offset, 21 + offset);
    context.strokeStyle = this.#theme.text;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.stroke();
    context.restore();
    texture.setSource(canvas);
    this.#closeButton.setLocalScale(1, 1, 1);
  }

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
    const { canvas, context, texture } = this.#panelTexture;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    this.#drawPanelBackground(context);
    this.#drawHeader(context);
    this.#drawSlots(context);
    context.restore();
    texture.setSource(canvas);
  }

  #drawPanelBackground(context) {
    context.shadowColor = this.#theme.withAlpha(this.#theme.shadow, 0.58);
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    this.#roundedRect(context, 8, 8, PANEL_WIDTH - 16, PANEL_HEIGHT - 20, 14);
    const gradient = context.createLinearGradient(
      0,
      8,
      PANEL_WIDTH,
      PANEL_HEIGHT,
    );
    gradient.addColorStop(0, this.#theme.surfaceTop);
    gradient.addColorStop(1, this.#theme.surfaceBottom);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = this.#theme.shadow;
    context.lineWidth = 2;
    context.stroke();
    this.#roundedRect(context, 12, 12, PANEL_WIDTH - 24, PANEL_HEIGHT - 28, 11);
    context.strokeStyle = this.#theme.withAlpha(this.#theme.outline, 0.72);
    context.lineWidth = 1;
    context.stroke();
  }

  #drawHeader(context) {
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = this.#theme.info;
    context.font = "700 10px Arial, sans-serif";
    context.fillText(
      this.#translate("game.inventory.backpack").toUpperCase(),
      24,
      36,
    );
    context.fillStyle = this.#theme.text;
    context.font = "700 27px Georgia, serif";
    context.fillText(this.#translate("game.inventory.title"), 24, 68);
    context.textAlign = "right";
    context.fillStyle = this.#theme.textMuted;
    context.font = "600 12px Arial, sans-serif";
    context.fillText(
      this.#translate("game.inventory.capacity", {
        current: this.#state.items.length,
        total: this.#state.capacity,
      }),
      PANEL_WIDTH - 24,
      66,
    );
    context.beginPath();
    context.moveTo(24, 82);
    context.lineTo(PANEL_WIDTH - 24, 82);
    context.strokeStyle = this.#theme.withAlpha(this.#theme.outline, 0.65);
    context.lineWidth = 1;
    context.stroke();
  }

  #drawSlots(context) {
    const left =
      (PANEL_WIDTH -
        SLOT_COLUMNS * SLOT_SIZE -
        (SLOT_COLUMNS - 1) * SLOT_GAP) /
      2;
    const top = 98;
    for (let index = 0; index < SLOT_COLUMNS * SLOT_ROWS; index += 1) {
      const column = index % SLOT_COLUMNS;
      const row = Math.floor(index / SLOT_COLUMNS);
      const x = left + column * (SLOT_SIZE + SLOT_GAP);
      const y = top + row * (SLOT_SIZE + SLOT_GAP);
      this.#drawSlot(context, x, y, this.#itemAtSlot(index), index);
    }
  }

  #drawSlot(context, x, y, item, slot) {
    const isDragSource = slot === this.#draggedItemSlot;
    const isHoveredDropSlot = slot === this.#dragHoveredSlot;
    const isValidDropSlot =
      isHoveredDropSlot && !item && this.#draggedItemSlot !== null;
    this.#roundedRect(context, x, y, SLOT_SIZE, SLOT_SIZE, 8);
    const gradient = context.createLinearGradient(
      x,
      y,
      x + SLOT_SIZE,
      y + SLOT_SIZE,
    );
    gradient.addColorStop(
      0,
      item ? this.#theme.surfaceRaisedTop : this.#theme.surfaceInsetTop,
    );
    gradient.addColorStop(
      1,
      item ? this.#theme.surfaceRaisedBottom : this.#theme.surfaceInsetBottom,
    );
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = isValidDropSlot
      ? this.#theme.withAlpha(this.#theme.positive, 0.98)
      : isHoveredDropSlot && item && !isDragSource
        ? this.#theme.withAlpha(this.#theme.negative, 0.94)
        : item
          ? this.#theme.withAlpha(this.#theme.outlineStrong, 0.9)
          : this.#theme.withAlpha(this.#theme.outline, 0.42);
    context.lineWidth = isHoveredDropSlot ? 3 : 1;
    context.stroke();

    if (!item || isDragSource) {
      context.beginPath();
      context.arc(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, 12, 0, Math.PI * 2);
      context.strokeStyle = isValidDropSlot
        ? this.#theme.withAlpha(this.#theme.positive, 0.72)
        : this.#theme.withAlpha(this.#theme.outlineStrong, 0.18);
      context.setLineDash([3, 3]);
      context.stroke();
      context.setLineDash([]);
      return;
    }

    if (!item.modelUrl) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = '38px "Segoe UI Emoji", sans-serif';
      context.fillStyle = this.#theme.text;
      context.fillText(item.icon, x + SLOT_SIZE / 2, y + 38);
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = this.#theme.text;
    context.font = ITEM_LABEL_FONT;
    context.fillText(
      this.#fitText(
        context,
        this.#translate(item.labelKey),
        ITEM_LABEL_MAXIMUM_WIDTH,
      ),
      x + SLOT_SIZE / 2,
      y + 72,
    );
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
    const { canvas, context, texture } = this.#tooltipTexture;
    context.font = ITEM_LABEL_FONT;
    if (context.measureText(label).width <= ITEM_LABEL_MAXIMUM_WIDTH) {
      this.#tooltip.enabled = false;
      return;
    }

    const column = this.#hoveredItemSlot % SLOT_COLUMNS;
    const row = Math.floor(this.#hoveredItemSlot / SLOT_COLUMNS);
    const slotLeft = this.#slotLeft + column * (SLOT_SIZE + SLOT_GAP);
    const slotTop = 98 + row * (SLOT_SIZE + SLOT_GAP);
    const centerX = Math.max(
      TOOLTIP_WIDTH / 2 + 8,
      Math.min(
        PANEL_WIDTH - TOOLTIP_WIDTH / 2 - 8,
        slotLeft + SLOT_SIZE / 2,
      ),
    );
    const centerY =
      row === 0
        ? slotTop + SLOT_SIZE + 4 + TOOLTIP_HEIGHT / 2
        : slotTop - 4 - TOOLTIP_HEIGHT / 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    context.shadowColor = this.#theme.withAlpha(this.#theme.shadow, 0.55);
    context.shadowBlur = 7;
    context.shadowOffsetY = 3;
    this.#roundedRect(
      context,
      1,
      1,
      TOOLTIP_WIDTH - 2,
      TOOLTIP_HEIGHT - 3,
      6,
    );
    const gradient = context.createLinearGradient(0, 0, 0, TOOLTIP_HEIGHT);
    gradient.addColorStop(0, this.#theme.surfaceTop);
    gradient.addColorStop(1, this.#theme.surfaceBottom);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = this.#theme.outlineStrong;
    context.lineWidth = 1;
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = this.#theme.text;
    context.font = TOOLTIP_FONT;
    context.fillText(
      label,
      TOOLTIP_WIDTH / 2,
      TOOLTIP_HEIGHT / 2 + 0.5,
    );
    context.restore();
    texture.setSource(canvas);
    this.#tooltip.setLocalPosition(
      centerX - PANEL_WIDTH / 2,
      PANEL_HEIGHT / 2 - centerY,
      0,
    );
    this.#tooltip.enabled = true;
  }

  #slotIndexAt(clientX, clientY, occupiedOnly = false) {
    if (!this.visible || !this.#panelTexture) {
      return null;
    }
    const { x: panelX, y: panelY } = this.#clientToPanel(clientX, clientY);
    for (let index = 0; index < this.#state.capacity; index += 1) {
      const column = index % SLOT_COLUMNS;
      const row = Math.floor(index / SLOT_COLUMNS);
      const x = this.#slotLeft + column * (SLOT_SIZE + SLOT_GAP);
      const y = 98 + row * (SLOT_SIZE + SLOT_GAP);
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
        ? this.#itemProjector.textureFor(item.modelUrl)
        : null;
      projection.element.texture = texture;
      projection.enabled =
        Boolean(texture) && slot !== this.#draggedItemSlot;
    }
  }

  #beginItemDrag(slot, clientX, clientY) {
    const item = this.#itemAtSlot(slot);
    if (!item) {
      return;
    }
    this.#draggedItemSlot = slot;
    this.#dragHoveredSlot = slot;
    this.#setHoveredItem(null);
    this.#dragVisual = this.#createItemVisual(item, "Dragged inventory item");
    this.#modalRoot.addChild(this.#dragVisual.entity);
    this.#positionItemVisual(this.#dragVisual, clientX, clientY);
    this.#syncItemProjections();
    this.#drawPanel();
    this.#entity.screen.syncDrawOrder();
    this.#updateCursor();
  }

  #finishItemDrag(clientX, clientY) {
    const sourceSlot = this.#draggedItemSlot;
    const targetSlot = this.#slotIndexAt(clientX, clientY);
    const validTarget =
      targetSlot !== null &&
      targetSlot !== sourceSlot &&
      !this.#itemAtSlot(targetSlot);
    const droppedOutside = !this.#panelContains(clientX, clientY);
    const visual = this.#dragVisual;

    this.#dragVisual = null;
    this.#draggedItemSlot = null;
    this.#dragHoveredSlot = null;

    if (validTarget && this.#onMoveItem?.(sourceSlot, targetSlot)) {
      this.#destroyItemVisual(visual);
    } else if (
      droppedOutside &&
      this.#onDropItem?.(sourceSlot, clientX, clientY)
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
    this.#syncItemProjections();
    this.#drawPanel();
    this.#updateCursor();
  }

  #createItemVisual(item, name) {
    let texture = this.#itemProjector.textureFor(item.modelUrl);
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
      context.fillStyle = this.#theme.text;
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
    return { entity, ownedTexture };
  }

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

  #destroyItemVisual(visual) {
    if (!visual) {
      return;
    }
    visual.entity.destroy();
    visual.ownedTexture?.destroy();
  }

  #panelContains(clientX, clientY) {
    const { x, y } = this.#clientToPanel(clientX, clientY);
    return x >= 0 && x <= PANEL_WIDTH && y >= 0 && y <= PANEL_HEIGHT;
  }

  #clientToPanel(clientX, clientY) {
    const { bounds, scale } = this.#canvasMetrics;
    return {
      x:
        (clientX - (bounds.left + bounds.width / 2)) / scale +
        PANEL_WIDTH / 2,
      y:
        (clientY - (bounds.top + bounds.height / 2)) / scale +
        PANEL_HEIGHT / 2,
    };
  }

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

  #itemAtSlot(slot) {
    if (!Number.isInteger(slot)) {
      return null;
    }
    return this.#state.items.find((item) => item.slot === slot) ?? null;
  }

  get #slotLeft() {
    return (
      (PANEL_WIDTH -
        SLOT_COLUMNS * SLOT_SIZE -
        (SLOT_COLUMNS - 1) * SLOT_GAP) /
      2
    );
  }

  #fitText(context, value, maximumWidth) {
    const text = String(value);
    if (context.measureText(text).width <= maximumWidth) {
      return text;
    }
    let fitted = text;
    while (
      fitted.length > 1 &&
      context.measureText(fitted + "…").width > maximumWidth
    ) {
      fitted = fitted.slice(0, -1);
    }
    return fitted + "…";
  }

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

  #roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }
}
