import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  colorFromHex,
  colorFromValue,
  colorToCss,
  shadeHexColor,
} from "../../src/game/helpers/colors.js";

class Color {
  constructor(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  clone() {
    return new Color(this.r, this.g, this.b);
  }
}

const pc = { Color };

describe("color helpers", () => {
  describe("colorFromHex", () => {
    it("converts a hexadecimal color to normalized RGB channels", () => {
      const color = colorFromHex(pc, 0x123456);

      assert.ok(color instanceof Color);
      assert.equal(color.r, 0x12 / 255);
      assert.equal(color.g, 0x34 / 255);
      assert.equal(color.b, 0x56 / 255);
    });
  });

  describe("colorToCss", () => {
    it("formats colors as six-digit CSS hexadecimal values", () => {
      assert.equal(colorToCss(0x000000), "#000000");
      assert.equal(colorToCss(0x0012ab), "#0012ab");
      assert.equal(colorToCss(0xabcdef), "#abcdef");
    });

    it("uses only the lowest 24 bits", () => {
      assert.equal(colorToCss(0x1234567), "#234567");
    });
  });

  describe("colorFromValue", () => {
    it("clones an existing PlayCanvas color", () => {
      const source = new Color(0.1, 0.2, 0.3);
      const color = colorFromValue(pc, source);

      assert.deepEqual(color, source);
      assert.notEqual(color, source);
    });

    it("creates a color from an RGB array and defaults missing channels", () => {
      assert.deepEqual(
        colorFromValue(pc, [0.25, 0.5]),
        new Color(0.25, 0.5, 1),
      );
    });

    it("creates colors from numeric and string hexadecimal values", () => {
      const expected = colorFromHex(pc, 0x336699);

      assert.deepEqual(colorFromValue(pc, 0x336699), expected);
      assert.deepEqual(colorFromValue(pc, "#336699"), expected);
      assert.deepEqual(colorFromValue(pc, "336699"), expected);
    });

    it("uses the default color when the value cannot be parsed", () => {
      assert.deepEqual(colorFromValue(pc, "not-a-color"), new Color(1, 1, 1));
    });

    it("supports a custom fallback color", () => {
      assert.deepEqual(
        colorFromValue(pc, undefined, 0x123456),
        colorFromHex(pc, 0x123456),
      );
    });
  });

  describe("shadeHexColor", () => {
    it("scales each RGB channel and rounds to the nearest integer", () => {
      assert.equal(shadeHexColor(0x80c0ff, 0.5), 0x406080);
    });

    it("preserves a color at full shade and removes it at zero shade", () => {
      assert.equal(shadeHexColor(0x123456, 1), 0x123456);
      assert.equal(shadeHexColor(0x123456, 0), 0x000000);
    });
  });
});
