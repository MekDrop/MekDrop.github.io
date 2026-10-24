import assert from "node:assert/strict";
import test from "node:test";
import { MapTestControlsHud } from "../../../../src/game/ui/MapTestControlsHud.js";
import { gameUiTheme } from "../../../../src/game/ui/GameUiTheme.js";

class Entity {
  children = [];
  #enabled = true;
  constructor(name) {
    this.name = name;
  }
  addComponent(type, options) {
    this[type] = {
      ...options,
      syncDrawOrder: () => {},
    };
  }
  addChild(child) {
    child.parent = this; this.children.push(child);
  }
  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parent = null;
  }
  setLocalPosition(x, y) {
    this.x = x; this.y = y;
  }
  set enabled(value) {
    this.#enabled = value;
  }
  get enabled() {
    return this.#enabled && (this.parent?.enabled ?? true);
  }
  destroy() {}
}

class TestHud extends MapTestControlsHud {
  createTextureRecord() {
    return {
      context: {
        scale: () => {},
        fillText: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        fill: () => {},
        stroke: () => {},
      },
      canvas: {},
      texture: { setSource: () => {} },
    };
  }
  drawPanelFrame() {}
}

test("tabs scroll to every group, isolate actions, and clean up input", () => {
  const originals = Object.getOwnPropertyDescriptors(gameUiTheme);
  Object.defineProperties(gameUiTheme, {
    text: {
      configurable: true,
      value: "white",
    },
    textMuted: {
      configurable: true,
      value: "gray",
    },
    surfaceTop: {
      configurable: true,
      value: "navy",
    },
    surfaceInsetTop: {
      configurable: true,
      value: "black",
    },
    outline: {
      configurable: true,
      value: "gray",
    },
    info: {
      configurable: true,
      value: "blue",
    },
    font: {
      configurable: true,
      value: () => "12px monospace",
    },
    playCanvasColor: {
      configurable: true,
      value: (pc, color) => color,
    },
  });
  try {
    const listeners = new Map();
    const executed = [];
    const canvas = {
      clientWidth: 1280,
      clientHeight: 720,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
      }),
      addEventListener: (type, callback) => listeners.set(type, callback),
      removeEventListener: (type) => listeners.delete(type),
      setPointerCapture: () => {},
    };
    const hud = new TestHud({
      pc: {
        Entity,
        Vec2: class {},
        Vec4: class {},
      },
      app: { graphicsDevice: { canvas } },
      panels: Array.from({ length: 5 }, (_, index) => ({
        title: `Group ${index}`,
        buttons: [{ label: `Action ${index}` }],
      })),
      controls: { execute: (button) => executed.push(button.label) },
    });
    // Supply the same top-left screen bounds that PlayCanvas calculates.
    const layout = (entity, x = 0, y = 0) => {
      x += entity.x ?? 0;
      y -= entity.y ?? 0;
      if (entity.element) {
        entity.element.canvasCorners = [{
          x,
          y: y + entity.element.height,
        }, {}, {
          x: x + entity.element.width,
          y,
        }];
      }
      for (const child of entity.children) {
        layout(child, x, y);
      }
    };
    const click = (x, y) => {
      layout(hud.entity);
      const event = {
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        preventDefault: () => {},
        stopImmediatePropagation: () => {},
      };
      listeners.get("pointerdown")({
        ...event,
        type: "pointerdown",
      });
      listeners.get("pointerup")({
        ...event,
        type: "pointerup",
      });
    };
    const panels = hud.entity.children.slice(0, -1);
    const strip = hud.entity.children.at(-1);
    assert.deepEqual(panels.map((panel) => panel.enabled), [true, false, false, false, false]);
    click(200, 115);
    click(40, 163);
    assert.deepEqual(executed, ["Action 1"]);
    for (let index = 0; index < 8; index++) {
      click(245, 115);
    }
    assert.equal(strip.children[1].element.opacity, 0.35);
    assert.equal(strip.children[6].enabled, true);
    click(200, 115);
    click(40, 163);
    assert.deepEqual(executed, ["Action 1", "Action 4"]);
    for (let index = 0; index < 8; index++) {
      click(30, 115);
    }
    assert.equal(strip.children[0].element.opacity, 0.35);
    assert.equal(strip.children[2].enabled, true);
    assert.equal(panels[4].enabled, true);
    hud.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    for (const name of ["text", "textMuted", "surfaceTop", "surfaceInsetTop", "outline", "info", "font", "playCanvasColor"]) {
      delete gameUiTheme[name];
      if (originals[name]) {
        Object.defineProperty(gameUiTheme, name, originals[name]);
      }
    }
  }
});
