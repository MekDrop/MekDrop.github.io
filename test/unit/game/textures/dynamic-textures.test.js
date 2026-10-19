import assert from "node:assert/strict";
import { test } from "node:test";
import { DynamicTextTexture } from "../../../../src/game/textures/text/DynamicTextTexture.js";
import { HeraldryTexture } from "../../../../src/game/textures/heraldry/HeraldryTexture.js";

test("text changes reuse the canvas and GPU texture, skip unchanged text, and release once", () => {
  const originalDocument = globalThis.document;
  const canvases = [];
  const uploads = [];
  const painted = [];
  let allocations = 0;
  let destroyed = 0;
  class Texture {
    constructor() {
      allocations++;
    }
    /**
     * @param {HTMLCanvasElement} canvas
     */
    setSource(canvas) {
      uploads.push(canvas);
    }
    destroy() {
      destroyed++;
    }
  }
  globalThis.document = {
    createElement: () => {
      const canvas = {};
      canvases.push(canvas);

      return canvas;
    },
  };
  try {
    const provider = new DynamicTextTexture({
      pc: { Texture },
      device: {},
      width: 512,
      height: 160,
      name: "test",
      text: "Courtyard",
      paint: (canvas, text) => painted.push(text),
    });
    const texture = provider.texture;
    provider.text = "Courtyard";
    provider.text = "Library";
    provider.text = "";
    assert.equal(provider.texture, texture);
    assert.equal(provider.text, "");
    assert.equal(allocations, 1);
    assert.equal(canvases.length, 1);
    assert.equal(uploads.length, 3);
    assert.ok(uploads.every(canvas => canvas === canvases[0]));
    assert.deepEqual(painted, ["Courtyard", "Library", ""]);
    provider.destroy();
    provider.destroy();
    assert.equal(destroyed, 1);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("heraldry recolours existing pixels without reallocating textures or leaking palette state", () => {
  const originalDocument = globalThis.document;
  const fills = [];
  let uploads = 0;
  let destroyed = 0;
  const context = {
    fillStyle: "",
    fillRect: () => fills.push(context.fillStyle),
  };
  class Texture {
    setSource() {
      uploads++;
    }
    destroy() {
      destroyed++;
    }
  }
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const flag = HeraldryTexture.flag({ Texture }, {});
    const banner = HeraldryTexture.banner({ Texture }, {});
    const texture = flag.texture;
    flag.palette = {
      field: "#ff0000",
      emblem: "#ffffff",
    };
    const palette = flag.palette;
    palette.field = "#000000";
    assert.equal(flag.palette.field, "#ff0000");
    assert.equal(banner.palette.field, "#245bb7");
    assert.equal(flag.texture, texture);
    assert.ok(fills.includes("#ff0000"));
    assert.ok(fills.includes("#ffffff"));
    assert.equal(uploads, 3);
    flag.destroy();
    flag.destroy();
    banner.destroy();
    assert.equal(destroyed, 2);
  } finally {
    globalThis.document = originalDocument;
  }
});
