import assert from "node:assert/strict";
import { it } from "node:test";
import { isCastleUpperFloorRoomVoid } from "../../../../../src/game/castle-generation/CastleGeometry.js";

const room = {
  opening: { start: 12, end: 20 },
  gatehouseDepth: 8,
  wallHeight: 12,
};

it("clears the full upper gatehouse interior into one room", () => {
  for (let blockU = 1; blockU < 7; blockU += 1) {
    for (let blockV = 8; blockV < 24; blockV += 1) {
      for (let blockY = 13; blockY < 18; blockY += 1) {
        assert.equal(
          isCastleUpperFloorRoomVoid({ blockU, blockY, blockV, ...room }),
          true,
        );
      }
    }
  }
});

it("keeps the upper room floor, ceiling, and exterior shell", () => {
  for (const [blockU, blockY, blockV] of [
    [3, 12, 16],
    [3, 18, 16],
    [0, 14, 16],
    [7, 14, 16],
    [3, 14, 7],
    [3, 14, 24],
  ]) {
    assert.equal(
      isCastleUpperFloorRoomVoid({ blockU, blockY, blockV, ...room }),
      false,
    );
  }
});
