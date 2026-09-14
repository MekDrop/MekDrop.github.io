import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMap } from "../../src/game/MapGenerator.js";

describe("map direction arrows", () => {
  it("shows inward arrows near both gate sides while clearing the gate tile and castle", () => {
    const mapData = generateMap({
      mapName: "mu00wyn4_0ysheeu",
    });
    const arrowsTooCloseToGateways = mapData.entries.flatMap(
      (entry, pathIdx) => {
        const gateRow = entry.rows.reduce((sum, row) => sum + row, 0) / 2;
        return [...mapData.arrowData.entries()].filter(([key, arrows]) => {
          const [col, row] = key.split(",").map(Number);
          return (
            arrows.some((arrow) => arrow.pathIdx === pathIdx) &&
            Math.abs(col - entry.col) + Math.abs(row - gateRow) <= 0.5
          );
        });
      },
    );
    const arrowsTooCloseToCastle = mapData.paths.flatMap((path, pathIdx) => {
      const castleEntrance = path.route.at(-1);
      return [...mapData.arrowData.entries()].filter(([key, arrows]) => {
        const [col, row] = key.split(",").map(Number);
        return (
          arrows.some((arrow) => arrow.pathIdx === pathIdx) &&
          Math.abs(col - castleEntrance.col) +
            Math.abs(row - castleEntrance.row) <=
            4
        );
      });
    });

    assert.ok(mapData.arrowData.size > 0);
    assert.deepEqual(
      new Set(mapData.entries.map((entry) => entry.side)),
      new Set(["LEFT", "RIGHT"]),
    );
    mapData.entries.forEach((entry, pathIdx) => {
      const gateRow = entry.rows.reduce((sum, row) => sum + row, 0) / 2;
      const inwardDc = entry.side === "LEFT" ? 1 : -1;
      const nearbyArrows = [...mapData.arrowData.entries()]
        .filter(([key]) => {
          const [col, row] = key.split(",").map(Number);
          const inwardDistance = (col - entry.col) * inwardDc;
          return row === gateRow && inwardDistance > 0.5 && inwardDistance <= 2;
        })
        .flatMap(([, arrows]) =>
          arrows.filter((arrow) => arrow.pathIdx === pathIdx),
        );

      assert.ok(
        nearbyArrows.length > 0,
        `Missing approach arrow for gate ${pathIdx}`,
      );
      for (const arrow of nearbyArrows) {
        assert.ok(arrow.dc * inwardDc > 0);
        assert.equal(arrow.dr, 0);
      }
    });
    assert.deepEqual(arrowsTooCloseToGateways, []);
    assert.deepEqual(arrowsTooCloseToCastle, []);
  });
});
