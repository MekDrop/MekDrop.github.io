import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RouteDataBuilder } from "../../../../../src/game/generator/map/RouteDataBuilder.js";
import { InvalidRouteWaypointError } from "../../../../../src/game/errors/map/index.js";

function createLayout() {
  return {
    pathRows: [10, 11],
    castleEntranceCol: 12,
    pathDipPlans: [],
    entries: [
      { gateCol: 0, gateRows: [10, 11], mergeCol: 6 },
      { gateCol: 20, gateRows: [10, 11], mergeCol: 6 },
    ],
  };
}

describe("RouteDataBuilder", () => {
  it("uses the quickest graph route instead of following an overshooting branch", () => {
    const layout = createLayout();
    const { routes, arrowData } = new RouteDataBuilder().buildRouteData(layout);
    assert.deepEqual(routes.map((route) => route.length), [25, 17]);
    for (const [pathIdx, route] of routes.entries()) {
      assert.deepEqual(route.at(-1), { col: 12, row: 10.5, elevation: 2 });
      const direction = pathIdx === 0 ? 1 : -1;
      for (let index = 1; index < route.length; index++) {
        assert.equal(route[index].col - route[index - 1].col, direction * 0.5);
      }
    }
    assert.ok(arrowData.size > 0);
    for (const [key, arrows] of arrowData) {
      const col = Number(key.split(",")[0]);
      for (const arrow of arrows) {
        assert.equal(Math.sign(arrow.dc), Math.sign(12 - col));
        assert.equal(arrow.dr, 0);
      }
    }
  });

  it("rejects route waypoints off the half-tile grid", () => {
    const layout = createLayout();
    layout.entries[0].mergeCol = 6.25;
    assert.throws(() => new RouteDataBuilder().buildRouteData(layout), InvalidRouteWaypointError);
  });
});
