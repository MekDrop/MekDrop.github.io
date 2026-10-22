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
   * @type {Array<{entity: import("playcanvas").Entity, button?: import("../debug/MapTestControls.js").MapTestButton, action?: () => void}>}
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
   * @type {import("playcanvas").Entity[]}
   */
  #tabs = [];
  /**
   * @type {number}
   */
  #activeTab = 0;
  /**
   * @type {number}
   */
  #firstTab = 0;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #previousTab = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #nextTab = null;

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
    const tabbed = panels.length > 1;
    if (tabbed) {
      const strip = this.createPanel({
        name: "Test control tabs",
        x: 16,
        y: 96,
        width: 480,
        height: 38,
      });
      this.#previousTab = this.#label(strip, "<", 0, 0, 34, 38);
      this.#nextTab = this.#label(strip, ">", 446, 0, 34, 38);
      this.#buttons.push({
        entity: this.#previousTab,
        action: () => this.#scrollTabs(-1),
      }, {
        entity: this.#nextTab,
        action: () => this.#scrollTabs(1),
      });
      for (const [index, definition] of panels.entries()) {
        const entity = this.#label(strip, definition.title, 38, 0, 200, 38);
        this.#tabs.push(entity);
        this.#buttons.push({
          entity,
          action: () => this.#selectTab(index),
        });
      }
    }
    const width = tabbed ? 480 : 240;
    for (const [index, definition] of panels.entries()) {
      const height = 46 + definition.buttons.length * 38 + (definition.statusTargetId ? 36 : 0);
      const panel = this.createPanel({
        name: definition.title,
        x: tabbed ? 16 : definition.x ?? 16,
        y: tabbed ? 140 : definition.y ?? 140,
        width,
        height,
      });
      const background = this.createTextureRecord(definition.title, width * 2, height * 2);
      background.context.scale(2, 2);
      this.drawPanelFrame(background.context, width, height);
      background.texture.setSource(background.canvas);
      this.createImage({
        parent: panel,
        name: "Panel background",
        x: 0,
        y: 0,
        width,
        height,
        texture: background.texture,
      });
      this.#panels.push(panel);
      this.#label(panel, definition.title, 10, 10, width - 20, 26);
      for (const [buttonIndex, button] of definition.buttons.entries()) {
        const entity = this.#label(panel, button.label, 10, 42 + buttonIndex * 38, width - 20, 30);
        this.#buttons.push({
          entity,
          button,
        });
      }
      if (definition.statusTargetId) {
        const record = this.createTextureRecord("Test status", (width - 20) * 2, 60);
        record.context.scale(2, 2);
        this.createImage({
          parent: panel,
          name: "Test status",
          x: 10,
          y: height - 34,
          width: width - 20,
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
    this.#refreshTabs();
    this.syncDrawOrder();
    for (const type of [INPUT_EVENT_TYPE.POINTER_DOWN, INPUT_EVENT_TYPE.POINTER_UP, INPUT_EVENT_TYPE.POINTER_MOVE, INPUT_EVENT_TYPE.POINTER_CANCEL, INPUT_EVENT_TYPE.WHEEL, INPUT_EVENT_TYPE.DOUBLE_CLICK]) {
      this.#canvas.addEventListener(type, this.#input, {
        capture: true,
        passive: false,
      });
    }
  }

  /**
   * @param {number} direction
   */
  #scrollTabs(direction) {
    this.#firstTab = Math.max(0, Math.min(this.#tabs.length - 2, this.#firstTab + direction));
    this.#refreshTabs();
  }

  /**
   * @param {number} index
   */
  #selectTab(index) {
    this.#activeTab = index;
    this.#refreshTabs();
  }

  #refreshTabs() {
    if (this.#tabs.length === 0) {
      return;
    }
    for (const [index, panel] of this.#panels.entries()) {
      panel.enabled = index === this.#activeTab;
    }
    for (const [index, tab] of this.#tabs.entries()) {
      tab.enabled = index >= this.#firstTab && index < this.#firstTab + 2;
      tab.setLocalPosition(38 + (index - this.#firstTab) * 204, 0, 0);
      tab.element.color = gameUiTheme.playCanvasColor(this.pc, index === this.#activeTab ? "#ffffff" : gameUiTheme.textMuted);
    }
    this.#previousTab.element.opacity = this.#firstTab > 0 ? 1 : 0.35;
    this.#nextTab.element.opacity = this.#firstTab + 2 < this.#tabs.length ? 1 : 0.35;
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
      (panel) => panel.enabled && this.#contains(panel, event)) || this.#buttons.some(
      /**
       * @param {{entity: import("playcanvas").Entity}} button
       */
      (button) => button.entity.enabled && this.#contains(button.entity, event));
    if (!inside && this.#pointer === null) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const index = this.#buttons.findIndex(/**
     *
     * @param {{entity: import("playcanvas").Entity}} button
     */
      (button) => button.entity.enabled && this.#contains(button.entity, event));
    if (event.type === INPUT_EVENT_TYPE.POINTER_DOWN && event.button === 0) {
      this.#pointer = event.pointerId;
      this.#pressed = index;
      this.#canvas.setPointerCapture(event.pointerId);
    } else if (event.type === INPUT_EVENT_TYPE.POINTER_UP && event.pointerId === this.#pointer) {
      if (index >= 0 && index === this.#pressed) {
        const pressed = this.#buttons[index];
        if (pressed.action) {
          pressed.action();
        } else {
          this.#controls.execute(pressed.button);
        }
      }
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
      if (text === status.previous) {
        continue;
      }
      status.previous = text;
      const { context, canvas, texture } = status.record;
      const width = canvas.width / 2;
      context.clearRect(0, 0, width, 30);
      context.fillStyle = gameUiTheme.text;
      context.font = gameUiTheme.font(500, 11);
      context.fillText(text, 4, 18, width - 8);
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
