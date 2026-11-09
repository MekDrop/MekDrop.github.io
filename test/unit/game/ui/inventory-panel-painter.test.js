import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../../../../src/game/ui/InventoryPanelPainter.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replaceAll("export ", "");
const theme = new Proxy({
  spaceSm: 8,
  borderRadius: 8,
  font: (weight, size) => `${weight} ${size}px sans-serif`,
  withAlpha: (color, alpha) => `${color}:${alpha}`,
}, { get: (target, key) => target[key] ?? key });
const Painter = new Function("gameUiTheme", `${source}\nreturn InventoryPanelPainter;`)(theme);

function target(width = 1290, height = 1260) {
  const calls = [];
  const context = new Proxy({}, {
    get: (state, key) => {
      if (key === "measureText") {
        return (text) => ({ width: text.length * 6 });
      }
      return (...args) => {
        calls.push([key, ...args]);

        return key === "createLinearGradient" ? { addColorStop: (...values) => calls.push(["stop", ...values]) } : undefined;
      };
    },
    set: (state, key, value) => {
      calls.push([key, value]);

      return true;
    },
  });

  return {
    canvas: {
      width,
      height,
    },
    context,
    calls,
  };
}

it("paints sparse slots and drag admission without mutating state or owning resources", () => {
  const painter = new Painter((key) => key);
  const state = Object.freeze({
    capacity: 12,
    items: Object.freeze([
      Object.freeze({
        slot: 0,
        icon: "X",
        labelKey: "short",
      }),
      Object.freeze({
        slot: 3,
        modelUrl: "model.glb",
        labelKey: "a very long item label",
      }),
    ]),
  });
  const panel = target();
  painter.drawPanel(panel, state, 0, 1);
  assert.deepEqual(panel.calls.slice(0, 3), [["clearRect", 0, 0, 1290, 1260], ["save"], ["scale", 3, 3]]);
  assert.equal(panel.calls.filter(([key]) => key === "arc").length, 11);
  assert(panel.calls.some(([key, value]) => key === "strokeStyle" && value === "positive:0.98"));
  assert(!panel.calls.some(([key, value]) => key === "fillText" && value === "X"));
  assert(panel.calls.some(([key, value]) => key === "fillText" && value.endsWith("â€¦")));
  assert.deepEqual(panel.calls.at(-1), ["restore"]);
  const occupied = target();
  painter.drawPanel(occupied, state, 0, 3);
  assert(occupied.calls.some(([key, value]) => key === "strokeStyle" && value === "negative:0.94"));
});

it("measures tooltip labels before scaling and paints only overflowing labels", () => {
  const painter = new Painter((key) => key);
  const tooltip = target(492, 75);
  assert.equal(painter.drawTooltip(tooltip, "short"), false);
  assert(!tooltip.calls.some(([key]) => key === "clearRect"));
  assert.equal(painter.drawTooltip(tooltip, "a very long translated item label"), true);
  assert(tooltip.calls.some(([key, x, y]) => key === "scale" && x === 3 && y === 3));
  assert.deepEqual(tooltip.calls.at(-1), ["restore"]);
});

it("paints pressed and hovered close feedback from the supplied snapshot", () => {
  const painter = new Painter((key) => key);
  const hovered = target(96, 96);
  painter.drawCloseButton(hovered, true, false);
  assert(hovered.calls.some(([key, value]) => key === "shadowBlur" && value === 5));
  const pressed = target(96, 96);
  painter.drawCloseButton(pressed, true, true);
  assert(pressed.calls.some(([key, x, y]) => key === "moveTo" && x === 12 && y === 12));
  assert(!pressed.calls.some(([key]) => key === "shadowBlur"));
});
