import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { DevWireframeInspector } from "../../src/game/debug/DevWireframeInspector.js";

class FakeEventTarget {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeWindow extends FakeEventTarget {
  #callbacks = new Map();
  #nextFrameId = 1;

  requestAnimationFrame(callback) {
    const id = this.#nextFrameId;
    this.#nextFrameId += 1;
    this.#callbacks.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id) {
    this.#callbacks.delete(id);
  }

  flushAnimationFrames() {
    const callbacks = [...this.#callbacks.values()];
    this.#callbacks.clear();
    for (const callback of callbacks) {
      callback();
    }
  }
}

class FakeMaterial {
  destroyed = false;

  update() {}

  destroy() {
    this.destroyed = true;
  }
}

class FakePicker {
  static selection = [];

  prepareCount = 0;
  destroyed = false;

  constructor() {
    FakePicker.instance = this;
  }

  resize() {}

  prepare() {
    this.prepareCount += 1;
  }

  getSelectionAsync() {
    return Promise.resolve(FakePicker.selection);
  }

  getWorldPointAsync() {
    return Promise.resolve(null);
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeColor {
  constructor(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
  }
}

const pc = {
  Color: FakeColor,
  Picker: FakePicker,
  RENDERSTYLE_WIREFRAME: 1,
  StandardMaterial: FakeMaterial,
};

let originalWindow;
let originalDocument;
let fakeWindow;
let fakeDocument;
let canvas;

beforeEach(() => {
  originalWindow = globalThis.window;
  originalDocument = globalThis.document;
  fakeWindow = new FakeWindow();
  fakeDocument = new FakeEventTarget();
  fakeDocument.hidden = false;
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  canvas = new FakeEventTarget();
  canvas.clientWidth = 800;
  canvas.clientHeight = 600;
  canvas.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 800,
    height: 600,
  });
  FakePicker.selection = [];
});

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});

test("shows only the hovered mesh as untextured wireframe while Alt is held", async () => {
  const originalMaterial = new FakeMaterial();
  const meshInstance = {
    material: originalMaterial,
    mesh: {},
    renderStyle: 0,
  };
  FakePicker.selection = [meshInstance];
  const inspector = new DevWireframeInspector({
    pc,
    app: { scene: {} },
    canvas,
    camera: {},
  });
  inspector.connect();

  canvas.dispatch("pointermove", {
    altKey: false,
    clientX: 120,
    clientY: 140,
    pointerType: "mouse",
  });
  assert.equal(FakePicker.instance.prepareCount, 0);

  fakeWindow.dispatch("keydown", {
    code: "AltLeft",
    key: "Alt",
    preventDefault() {},
  });
  fakeWindow.flushAnimationFrames();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(meshInstance.renderStyle, pc.RENDERSTYLE_WIREFRAME);
  assert.notEqual(meshInstance.material, originalMaterial);
  assert.equal(meshInstance.material.diffuseMap, undefined);

  fakeWindow.dispatch("keyup", {
    code: "AltLeft",
    key: "Alt",
    preventDefault() {},
  });
  assert.equal(meshInstance.renderStyle, 0);
  assert.equal(meshInstance.material, originalMaterial);

  inspector.destroy();
});

test("restores the mesh when the pointer leaves the canvas", async () => {
  const originalMaterial = new FakeMaterial();
  const meshInstance = {
    material: originalMaterial,
    mesh: {},
    renderStyle: 0,
  };
  FakePicker.selection = [meshInstance];
  const inspector = new DevWireframeInspector({
    pc,
    app: { scene: {} },
    canvas,
    camera: {},
  });
  inspector.connect();

  canvas.dispatch("pointermove", {
    altKey: true,
    clientX: 120,
    clientY: 140,
    pointerType: "mouse",
  });
  fakeWindow.flushAnimationFrames();
  await Promise.resolve();
  await Promise.resolve();
  canvas.dispatch("pointerleave", { pointerType: "mouse" });

  assert.equal(meshInstance.renderStyle, 0);
  assert.equal(meshInstance.material, originalMaterial);

  inspector.destroy();
});
