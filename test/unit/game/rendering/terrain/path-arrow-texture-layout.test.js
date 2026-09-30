import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PathArrowTextureLayout } from "../../../../../src/game/rendering/terrain/PathArrowTextureLayout.js";

describe("PathArrowTextureLayout", () => {
  it("keeps lane-centered placement, forward direction and all merged route colors", () => {
    const markers = PathArrowTextureLayout.markers({
      entries: [{ color: 0xff0000 }, { color: 0x0000ff }],
      arrowData: new Map([
        ["4,5,2", [{ dc: 1, dr: 0, pathIdx: 0 }]],
        ["4,5.5,2", [{ dc: 1, dr: 0, pathIdx: 1 }]],
      ]),
    });
    assert.deepEqual(markers, [{
      col: 4, row: 5.25, elevation: 2, dx: 1, dz: 0, pitch: 0, palette: 3,
    }]);
  });

  it("keeps stacked routes separate and preserves uphill and downhill projections", () => {
    const markers = PathArrowTextureLayout.markers({
      entries: [{ color: 0xff0000 }],
      arrowData: new Map([
        ["4,5.5,2.5", [{ dc: 0, dr: 1, pathIdx: 0, surfacePitch: 45 }]],
        ["4,5.5,5.5", [{ dc: -1, dr: 0, pathIdx: 0, surfacePitch: -45 }]],
      ]),
    });
    assert.equal(markers.length, 2);
    assert.equal(markers[0].pitch, Math.PI / 4);
    assert.equal(markers[1].pitch, -Math.PI / 4);
    assert.equal(markers[0].dz, 1);
    assert.equal(markers[1].dx, -1);
  });

  it("preserves diagonal turn direction and ignores maps without route markers", () => {
    const [marker] = PathArrowTextureLayout.markers({
      entries: [{ color: 0xff0000 }],
      arrowData: new Map([["4.5,5.5,2", [{ dc: 1, dr: -1, pathIdx: 0 }]]]),
    });
    assert.equal(marker.col, 4.5);
    assert.equal(marker.row, 5.5);
    assert.equal(marker.dx, 1 / Math.sqrt(2));
    assert.equal(marker.dz, -1 / Math.sqrt(2));
    assert.deepEqual(PathArrowTextureLayout.markers({ entries: [] }), []);
  });
});
