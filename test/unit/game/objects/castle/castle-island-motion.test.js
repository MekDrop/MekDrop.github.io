import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { IslandCellOwnership } from "../../../../../src/game/objects/shared/IslandCellOwnership.js";
import { SCENE_OBJECT_TYPE } from "../../../../../src/game/enum/SceneObjectType.js";

// Isolate asset construction while exercising castle ownership and real engine transforms.
const source = readFileSync(
  new URL("../../../../../src/game/objects/castle/Castle.js", import.meta.url),
  "utf8",
).replace(/^(?:import|export \{)[^\n]+\r?\n/gm, "");
class CastleEntityBuilder {
  constructor() {
    this.entity = new pc.Entity("Castle");
    for (const name of ["walls", "stairs", "door", "banner"]) {
      const child = new pc.Entity(name);
      child.setLocalPosition(2, 3, 4);
      this.entity.addChild(child);
    }
  }
}
const { Castle } = new Function(
  "CastleEntityBuilder", "IslandCellOwnership", "SCENE_OBJECT_TYPE",
  `${source.replace("export class Castle", "class Castle")}\nreturn { Castle };`,
)(CastleEntityBuilder, IslandCellOwnership, SCENE_OBJECT_TYPE);

it("moves the complete castle with its owning island without accumulating offsets", () => {
  const mapData = {
    cols: 20,
    rows: 16,
    islandConnectorData: { nearIsland: ["2,3"], farIsland: ["14,9"] },
  };
  for (const [col, row, group] of [[2, 3, 0], [14, 9, 1], [0, 0, -1]]) {
    const castle = new Castle({
      pc,
      definition: {
        id: "castle-test",
        buildPlan: { input: { position: { x: col - 10, z: row - 8 } } },
      },
      runtime: { mapData, textureAssets: { get: () => ({ resource: null }) } },
    });
    try {
      for (const offsets of [[0.5, -0.25], [-0.1, 0.75], [0, 0]]) {
        castle.setIslandOffsets(...offsets);
        const offset = offsets[group] ?? 0;
        for (const child of castle.entity.children) {
          assert.deepEqual(child.getLocalPosition().toArray(), [2, 3, 4]);
          assert.ok(Math.abs(child.getPosition().y - (3 + offset)) < 1e-6);
          assert.equal(child.getPosition().x, 2);
          assert.equal(child.getPosition().z, 4);
        }
      }
    } finally {
      castle.entity.destroy();
    }
  }
});
