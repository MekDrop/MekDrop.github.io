import assert from "node:assert/strict";
import { it } from "node:test";
import { runtimeErrorDescription } from "../../src/boot/runtime-errors.js";

it("preserves useful details from global exceptions", () => {
  assert.equal(runtimeErrorDescription(new TypeError("bad animation")),
    "bad animation");
  assert.equal(runtimeErrorDescription({ message: "rejected render" }),
    "rejected render");
  assert.equal(runtimeErrorDescription("plain failure"), "plain failure");
});

it("provides a safe description for unknown rejection values", () => {
  assert.equal(runtimeErrorDescription(null), "An unknown error occurred.");
});
