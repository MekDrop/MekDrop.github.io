import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
} from "../../src/game/helpers/types.js";

describe("type helpers", () => {
  describe("isFunction", () => {
    it("accepts functions and rejects non-functions", () => {
      assert.equal(isFunction(() => {}), true);
      assert.equal(isFunction(class Example {}), true);
      assert.equal(isFunction({}), false);
      assert.equal(isFunction(null), false);
    });
  });

  describe("isArray", () => {
    it("accepts arrays and rejects array-like values", () => {
      assert.equal(isArray([]), true);
      assert.equal(isArray(new Array(2)), true);
      assert.equal(isArray({ 0: "value", length: 1 }), false);
      assert.equal(isArray("value"), false);
    });
  });

  describe("isNumber", () => {
    it("accepts number primitives and rejects non-number values", () => {
      assert.equal(isNumber(0), true);
      assert.equal(isNumber(Number.NaN), true);
      assert.equal(isNumber(Number.POSITIVE_INFINITY), true);
      assert.equal(isNumber("1"), false);
      assert.equal(isNumber(new Number(1)), false);
    });
  });

  describe("isString", () => {
    it("accepts string primitives and rejects non-string values", () => {
      assert.equal(isString(""), true);
      assert.equal(isString("value"), true);
      assert.equal(isString(1), false);
      assert.equal(isString(new String("value")), false);
    });
  });

  describe("isObject", () => {
    it("accepts non-null objects except arrays", () => {
      assert.equal(isObject({}), true);
      assert.equal(isObject(new Date()), true);
      assert.equal(isObject([]), false);
      assert.equal(isObject(null), false);
      assert.equal(isObject(() => {}), false);
      assert.equal(isObject("value"), false);
    });
  });
});
