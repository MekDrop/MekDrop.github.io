import { GamePanelHud } from "./GamePanelHud.js";
import { gameUiTheme } from "./GameUiTheme.js";
import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

/**
 * @typedef {object} MapTestPanel
 * @property {string} title
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [statusTargetId]
 * @property {import("../debug/MapTestControls.js").MapTestButton[]} buttons
 */

/**
 * Optional map-authored testing panels rendered through the game's HUD.
 */
export class MapTestControlsHud extends GamePanelHud {
  /**
   * @type {import("../debug/MapTestControls.js").MapTestControls}
   */
  #controls;
  /**
   * @type {Array<{entity: import("playcanvas").Entity, button: import("../debug/MapTestControls.js").MapTestButton}>}
   */
  #buttons = [];
  /**
   * @type {Array<import("playcanvas").Entity>}
   */
  #panels = [];
  /**
   * @type {Array<{record: ReturnType<GamePanelHud["createTextureRecord"]>, targetId: string, previous: string}>}
   */
  #statuses = [];
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {number|null}
   */
  #pointer = null;
  /**
   * @type {number}
   */
  #pressed = -1;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, panels: MapTestPanel[], controls: import("../debug/MapTestControls.js").MapTestControls}} options
   */
  constructor({ pc, app, panels, controls }) {
    super({
      pc,
      app,
      name: "Map test controls",
      priority: 108,
    });

    this.#controls = controls;
    this.#canvas = app.graphicsDevice.canvas;
    for (const [index, definition] of panels.entries()) {
      const height = 46 + definition.buttons.length * 38 + (definition.statusTargetId ? 36 : 0);
      const panel = this.createPanel({
        name: definition.title,
        x: definition.x ?? 16,
        y: definition.y ?? 140 + index * (height + 12),
        width: 240,
        height,
      });
      const background = this.createTextureRecord(definition.title, 480, height * 2);
      background.context.scale(2, 2);
      this.drawPanelFrame(background.context, 240, height);
      background.texture.setSource(background.canvas);
      this.createImage({
        parent: panel,
        name: "Panel background",
        x: 0,
        y: 0,
        width: 240,
        height,
        texture: background.texture,
      });
      this.#panels.push(panel);
      this.#label(panel, definition.title, 10, 10, 220, 26);
      for (const [buttonIndex, button] of definition.buttons.entries()) {
        const entity = this.#label(panel, button.label, 10, 42 + buttonIndex * 38, 220, 30);
        this.#buttons.push({
          entity,
          button,
        });
      }
      if (definition.statusTargetId) {
        const record = this.createTextureRecord("Test status", 440, 60);
        record.context.scale(2, 2);
        this.createImage({
          parent: panel,
          name: "Test status",
          x: 10,
          y: height - 34,
          width: 220,
          height: 30,
          texture: record.texture,
        });
        this.#statuses.push({
          record,
          targetId: definition.statusTargetId,
          previous: "",
        });
      }
    }
    this.syncDrawOrder();
    for (const type of [INPUT_EVENT_TYPE.POINTER_DOWN, INPUT_EVENT_TYPE.POINTER_UP, INPUT_EVENT_TYPE.POINTER_MOVE, INPUT_EVENT_TYPE.POINTER_CANCEL, INPUT_EVENT_TYPE.WHEEL, INPUT_EVENT_TYPE.DOUBLE_CLICK]) {
      this.#canvas.addEventListener(type, this.#input, {
        capture: true,
        passive: false,
      });
    }
  }

  /**
   * @param {import("playcanvas").Entity} parent
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {import("playcanvas").Entity}
   */
  #label(parent, text, x, y, width, height) {
    const record = this.createTextureRecord(text, width * 2, height * 2);
    const context = record.context;
    context.scale(2, 2);
    this.drawPanelFrame(context, width, height);
    context.fillStyle = gameUiTheme.text;
    context.font = gameUiTheme.font(700, 12);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2, width - 12);
    record.texture.setSource(record.canvas);
    return this.createImage({
      parent,
      name: text,
      x,
      y,
      width,
      height,
      texture: record.texture,
    });
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {PointerEvent|WheelEvent|MouseEvent} event
   * @returns {boolean}
   */
  #contains(entity, event) {
    const bounds = this.#canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * this.#canvas.clientWidth / bounds.width;
    const y = (event.clientY - bounds.top) * this.#canvas.clientHeight / bounds.height;
    const corners = entity.element.canvasCorners;
    return x >= corners[0].x && x <= corners[2].x && y >= corners[2].y && y <= corners[0].y;
  }

  /**
   * @type {(event: PointerEvent|WheelEvent|MouseEvent) => void}
   * @param {PointerEvent|WheelEvent|MouseEvent} event
   */
  #input = (event) => {
    const inside = this.#panels.some(/**
     *
     * @param {import("playcanvas").Entity} panel
     */
      (panel) => this.#contains(panel, event));
    if (!inside && this.#pointer === null) { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    const index = this.#buttons.findIndex(/**
     *
     * @param {{entity: import("playcanvas").Entity}} button
     */
      (button) => this.#contains(button.entity, event));
    if (event.type === INPUT_EVENT_TYPE.POINTER_DOWN && event.button === 0) {
      this.#pointer = event.pointerId;
      this.#pressed = index;
      this.#canvas.setPointerCapture(event.pointerId);
    } else if (event.type === INPUT_EVENT_TYPE.POINTER_UP && event.pointerId === this.#pointer) {
      if (index >= 0 && index === this.#pressed) { this.#controls.execute(this.#buttons[index].button); }
      this.#pointer = null;
      this.#pressed = -1;
    } else if (event.type === INPUT_EVENT_TYPE.POINTER_CANCEL) {
      this.#pointer = null;
      this.#pressed = -1;
    }
  };

  update() {
    for (const status of this.#statuses) {
      const text = this.#controls.status(status.targetId);
      if (text === status.previous) { continue; }
      status.previous = text;
      const { context, canvas, texture } = status.record;
      context.clearRect(0, 0, 220, 30);
      context.fillStyle = gameUiTheme.text;
      context.font = gameUiTheme.font(500, 11);
      context.fillText(text, 4, 18, 212);
      texture.setSource(canvas);
    }
  }

  destroy() {
    if (this.#pointer !== null && this.#canvas.hasPointerCapture(this.#pointer)) {
      this.#canvas.releasePointerCapture(this.#pointer);
    }
    for (const type of [INPUT_EVENT_TYPE.POINTER_DOWN, INPUT_EVENT_TYPE.POINTER_UP, INPUT_EVENT_TYPE.POINTER_MOVE, INPUT_EVENT_TYPE.POINTER_CANCEL, INPUT_EVENT_TYPE.WHEEL, INPUT_EVENT_TYPE.DOUBLE_CLICK]) {
      this.#canvas.removeEventListener(type, this.#input, true);
    }
    super.destroy();
  }
}
