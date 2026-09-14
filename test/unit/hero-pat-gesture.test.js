import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroPatGesture } from "../../src/game/controls/HeroPatGesture.js";

it("counts actual strokes, leaves other mouse gestures alone, and releases capture on blur", (context) => {
  const originalWindow = globalThis.window;
  const fakeWindow = new EventTarget();
  globalThis.window = fakeWindow;
  context.after(() => {
    gesture.destroy();
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });
  const canvas = new EventTarget();
  const captured = new Set();
  canvas.classList = { toggle() {}, remove() {} };
  canvas.setPointerCapture = (id) => captured.add(id);
  canvas.hasPointerCapture = (id) => captured.has(id);
  canvas.releasePointerCapture = (id) => captured.delete(id);
  let pats = 0;
  const gesture = new HeroPatGesture(canvas, {
    hitTest: (event) => event.clientX >= 0 && event.clientX <= 40,
    pat: () => { pats += 1; },
  });
  const send = (type, options = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      pointerType: "mouse", pointerId: 1, button: 0, buttons: 1,
      clientX: 20, clientY: 20, ...options,
    });
    canvas.dispatchEvent(event);
    return event;
  };
  for (const options of [{ button: 2 }, { clientX: 80 }, { pointerType: "touch" }, { altKey: true }]) {
    assert.equal(send("pointerdown", options).defaultPrevented, false);
  }
  assert.equal(pats, 0);
  assert.equal(send("pointerdown").defaultPrevented, true);
  assert.equal(pats, 1);
  assert.ok(captured.has(1));
  for (let i = 0; i < 20; i += 1) {
    send("pointermove");
  }
  assert.equal(pats, 1);
  send("pointermove", { clientX: 36 });
  assert.equal(pats, 2);
  send("pointermove", { clientX: 80 });
  send("pointermove", { clientX: 100 });
  assert.equal(pats, 2);
  fakeWindow.dispatchEvent(new Event("blur"));
  assert.equal(captured.size, 0);
  send("pointermove", { clientX: 0 });
  assert.equal(pats, 2);
  send("pointerdown");
  send("pointercancel");
  assert.equal(captured.size, 0);
  gesture.destroy();
  send("pointerdown");
  assert.equal(pats, 3);
});
