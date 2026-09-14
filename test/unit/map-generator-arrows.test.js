import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMap } from "../../src/game/MapGenerator.js";

describe("map direction arrows", () => {
  it("leaves enough clearance around gateways and the castle", () => {
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
            Math.abs(col - entry.col) + Math.abs(row - gateRow) <= 2
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
    assert.deepEqual(arrowsTooCloseToGateways, []);
    assert.deepEqual(arrowsTooCloseToCastle, []);
  });
});
