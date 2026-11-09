import { gameUiTheme } from "./GameUiTheme.js";

/**
 * @typedef {import("./InventoryHud.js").InventoryItem} InventoryItem
 */
/**
 * @typedef {import("./InventoryHud.js").InventoryState} InventoryState
 */
/**
 * @typedef {import("./InventoryHud.js").TextureRecord} TextureRecord
 */

export const PANEL_WIDTH = 430;
export const PANEL_HEIGHT = 420;
export const PANEL_TEXTURE_SCALE = 3;
export const SLOT_COLUMNS = 4;
export const SLOT_ROWS = 3;
export const SLOT_SIZE = 90;
const ITEM_LABEL_MAXIMUM_WIDTH = SLOT_SIZE - 12;
export const TOOLTIP_WIDTH = 164;
export const TOOLTIP_HEIGHT = 25;

export const CLOSE_BUTTON_SIZE = 32;

/**
 * Draws into borrowed canvases. The HUD owns textures, entities and interaction state.
 */
export class InventoryPanelPainter {
  /**
   * @type {(key: string, values?: {current: number, total: number}) => string}
   */
  #translate;

  /**
   * @param {(key: string, values?: {current: number, total: number}) => string} translate
   */
  constructor(translate) {
    this.#translate = translate;
  }

  /**
   * @param {TextureRecord} target
   * @param {InventoryState} state
   * @param {number|null} draggedItemSlot
   * @param {number|null} dragHoveredSlot
   */
  drawPanel({ canvas, context }, state, draggedItemSlot, dragHoveredSlot) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    this.#drawPanelBackground(context);
    this.#drawHeader(context, state);
    this.#drawSlots(context, state, draggedItemSlot, dragHoveredSlot);
    context.restore();
  }

  /**
   * @param {TextureRecord} target
   * @param {string} label
   * @returns {boolean} Whether the full label needs a tooltip.
   */
  drawTooltip({ canvas, context }, label) {
    context.font = gameUiTheme.font(600, 10);
    if (context.measureText(label).width <= ITEM_LABEL_MAXIMUM_WIDTH) {
      return false;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    context.shadowColor = gameUiTheme.withAlpha(gameUiTheme.shadow, 0.55);
    context.shadowBlur = 7;
    context.shadowOffsetY = 3;
    this.#roundedRect(
      context,
      1,
      1,
      TOOLTIP_WIDTH - 2,
      TOOLTIP_HEIGHT - 3,
      gameUiTheme.borderRadius,
    );
    const gradient = context.createLinearGradient(0, 0, 0, TOOLTIP_HEIGHT);
    gradient.addColorStop(0, gameUiTheme.surfaceTop);
    gradient.addColorStop(1, gameUiTheme.surfaceBottom);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = gameUiTheme.outlineStrong;
    context.lineWidth = 1;
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = gameUiTheme.text;
    context.font = gameUiTheme.font(600, 11);
    context.fillText(
      label,
      TOOLTIP_WIDTH / 2,
      TOOLTIP_HEIGHT / 2 + 0.5,
    );
    context.restore();

    return true;
  }

  /**
   * @param {TextureRecord} target
   * @param {boolean} hovered
   * @param {boolean} pressed
   */
  drawCloseButton({ canvas, context }, hovered, pressed) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    const inset = pressed ? 2 : 1;
    if (hovered && !pressed) {
      context.shadowColor = gameUiTheme.withAlpha(
        gameUiTheme.outlineStrong,
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
      gameUiTheme.borderRadius,
    );
    const gradient = context.createLinearGradient(0, 0, 0, CLOSE_BUTTON_SIZE);
    if (pressed) {
      gradient.addColorStop(0, gameUiTheme.surfaceInsetTop);
      gradient.addColorStop(1, gameUiTheme.surfaceInsetBottom);
    } else if (hovered) {
      gradient.addColorStop(0, gameUiTheme.outlineStrong);
      gradient.addColorStop(1, gameUiTheme.surfaceRaisedTop);
    } else {
      gradient.addColorStop(0, gameUiTheme.surfaceRaisedTop);
      gradient.addColorStop(1, gameUiTheme.surfaceRaisedBottom);
    }
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = hovered
      ? gameUiTheme.textMuted
      : gameUiTheme.outline;
    context.lineWidth = pressed ? 1.5 : 1;
    context.stroke();
    const offset = pressed ? 1 : 0;
    context.beginPath();
    context.moveTo(11 + offset, 11 + offset);
    context.lineTo(21 + offset, 21 + offset);
    context.moveTo(21 + offset, 11 + offset);
    context.lineTo(11 + offset, 21 + offset);
    context.strokeStyle = gameUiTheme.text;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.stroke();
    context.restore();
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   */
  #drawPanelBackground(context) {
    context.shadowColor = gameUiTheme.withAlpha(gameUiTheme.shadow, 0.58);
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    this.#roundedRect(
      context,
      8,
      8,
      PANEL_WIDTH - 16,
      PANEL_HEIGHT - 20,
      gameUiTheme.borderRadius,
    );
    const gradient = context.createLinearGradient(
      0,
      8,
      PANEL_WIDTH,
      PANEL_HEIGHT,
    );
    gradient.addColorStop(0, gameUiTheme.surfaceTop);
    gradient.addColorStop(1, gameUiTheme.surfaceBottom);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = gameUiTheme.shadow;
    context.lineWidth = 2;
    context.stroke();
    this.#roundedRect(
      context,
      12,
      12,
      PANEL_WIDTH - 24,
      PANEL_HEIGHT - 28,
      gameUiTheme.borderRadius,
    );
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.outline, 0.72);
    context.lineWidth = 1;
    context.stroke();
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {InventoryState} state
   */
  #drawHeader(context, state) {
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = gameUiTheme.info;
    context.font = gameUiTheme.font(700, 10);
    context.fillText(
      this.#translate("game.inventory.backpack").toUpperCase(),
      24,
      36,
    );
    context.fillStyle = gameUiTheme.text;
    context.font = gameUiTheme.font(700, 27);
    context.fillText(this.#translate("game.inventory.title"), 24, 68);
    context.textAlign = "right";
    context.fillStyle = gameUiTheme.textMuted;
    context.font = gameUiTheme.font(600, 12);
    context.fillText(
      this.#translate("game.inventory.capacity", {
        current: state.items.length,
        total: state.capacity,
      }),
      PANEL_WIDTH - 24,
      66,
    );
    context.beginPath();
    context.moveTo(24, 82);
    context.lineTo(PANEL_WIDTH - 24, 82);
    context.strokeStyle = gameUiTheme.withAlpha(gameUiTheme.outline, 0.65);
    context.lineWidth = 1;
    context.stroke();
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {InventoryState} state
   * @param {number|null} draggedItemSlot
   * @param {number|null} dragHoveredSlot
   */
  #drawSlots(context, state, draggedItemSlot, dragHoveredSlot) {
    const left =
      (PANEL_WIDTH -
        SLOT_COLUMNS * SLOT_SIZE -
        (SLOT_COLUMNS - 1) * gameUiTheme.spaceSm) /
      2;
    const top = 98;
    for (let index = 0; index < SLOT_COLUMNS * SLOT_ROWS; index += 1) {
      const column = index % SLOT_COLUMNS;
      const row = Math.floor(index / SLOT_COLUMNS);
      const x = left + column * (SLOT_SIZE + gameUiTheme.spaceSm);
      const y = top + row * (SLOT_SIZE + gameUiTheme.spaceSm);
      const item = state.items.find(/**
       * @param {InventoryItem} item
       */
        (item) => item.slot === index) ?? null;
      this.#drawSlot(
        context, x, y, item, index, draggedItemSlot, dragHoveredSlot,
      );
    }
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {number} x
   * @param {number} y
   * @param {InventoryItem|null} item
   * @param {number} slot
   * @param {number|null} draggedItemSlot
   * @param {number|null} dragHoveredSlot
   */
  #drawSlot(context, x, y, item, slot, draggedItemSlot, dragHoveredSlot) {
    const isDragSource = slot === draggedItemSlot;
    const isHoveredDropSlot = slot === dragHoveredSlot;
    const isValidDropSlot =
      isHoveredDropSlot && !item && draggedItemSlot !== null;
    this.#roundedRect(
      context,
      x,
      y,
      SLOT_SIZE,
      SLOT_SIZE,
      gameUiTheme.borderRadius,
    );
    const gradient = context.createLinearGradient(
      x,
      y,
      x + SLOT_SIZE,
      y + SLOT_SIZE,
    );
    gradient.addColorStop(
      0,
      item ? gameUiTheme.surfaceRaisedTop : gameUiTheme.surfaceInsetTop,
    );
    gradient.addColorStop(
      1,
      item ? gameUiTheme.surfaceRaisedBottom : gameUiTheme.surfaceInsetBottom,
    );
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = isValidDropSlot
      ? gameUiTheme.withAlpha(gameUiTheme.positive, 0.98)
      : isHoveredDropSlot && item && !isDragSource
        ? gameUiTheme.withAlpha(gameUiTheme.negative, 0.94)
        : item
          ? gameUiTheme.withAlpha(gameUiTheme.outlineStrong, 0.9)
          : gameUiTheme.withAlpha(gameUiTheme.outline, 0.42);
    context.lineWidth = isHoveredDropSlot ? 3 : 1;
    context.stroke();

    if (!item || isDragSource) {
      context.beginPath();
      context.arc(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, 12, 0, Math.PI * 2);
      context.strokeStyle = isValidDropSlot
        ? gameUiTheme.withAlpha(gameUiTheme.positive, 0.72)
        : gameUiTheme.withAlpha(gameUiTheme.outlineStrong, 0.18);
      context.setLineDash([3, 3]);
      context.stroke();
      context.setLineDash([]);

      return;
    }

    if (!item.modelUrl) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = '38px "Segoe UI Emoji", sans-serif';
      context.fillStyle = gameUiTheme.text;
      context.fillText(item.icon, x + SLOT_SIZE / 2, y + 38);
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = gameUiTheme.text;
    context.font = gameUiTheme.font(600, 10);
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

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {string} value
   * @param {number} maximumWidth
   */
  #fitText(context, value, maximumWidth) {
    const text = String(value);
    if (context.measureText(text).width <= maximumWidth) {
      return text;
    }
    let fitted = text;
    while (
      fitted.length > 1 &&
      context.measureText(fitted + "â€¦").width > maximumWidth
    ) {
      fitted = fitted.slice(0, -1);
    }

    return fitted + "â€¦";
  }

  /**
   *
   * @param {CanvasRenderingContext2D} context
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   */
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
