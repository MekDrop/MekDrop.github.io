import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAmbientWind,
  getAmbientWindSpeed,
} from "../../src/game/objects/shared/AmbientWind.js";

describe("ambient wind", () => {
  it("stays gentle between gusts", () => {
    assert.ok(getAmbientWindSpeed(0) < 0.18);
  });

  it("occasionally produces a smooth strong gust", () => {
    const gustPeakSeconds = Math.PI / 0.13;

    assert.ok(getAmbientWindSpeed(gustPeakSeconds) > 0.27);
  });

  it("always returns a normalized horizontal direction", () => {
    const wind = getAmbientWind(19);

    assert.equal(wind.direction.y, 0);
    assert.ok(
      Math.abs(Math.hypot(wind.direction.x, wind.direction.z) - 1) <
        0.000001,
    );
  });
});
