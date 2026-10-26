import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../../../../src/game/enum/CastleTerracePhase.js";
import { TerracePropGrip } from "../../../../../../../src/game/objects/castle/rooms/terrace/TerracePropGrip.js";

const source = readFileSync(new URL("../../../../../../../src/game/objects/castle/rooms/terrace/TerraceFurnitureActions.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Actions = new Function("tableUrl", "chairUrl", "PHASE", "TerracePropGrip",
  `${source.replace("export class", "class")}\nreturn TerraceFurnitureActions;`)("table", "chair", PHASE, TerracePropGrip);

it("centers table grips on the palms when furniture and actor scales differ", () => {
  for (const yaw of [0, 73, 180]) {
    const stage = new pc.Entity("Stage");
    stage.setLocalScale(0.45, 0.45, 0.45);
    stage.setLocalPosition(3, 2, -4);
    const entity = new pc.Entity("Servant");
    entity.setLocalScale(0.62, 0.62, 0.62);
    entity.setLocalEulerAngles(0, yaw, 0);
    entity.setLocalPosition(4, 2, -3);
    const leftHand = new pc.Entity("Left palm");
    const rightHand = new pc.Entity("Right palm");
    entity.addChild(leftHand);
    entity.addChild(rightHand);
    leftHand.setLocalPosition(-0.3, 1.1, 0.4);
    rightHand.setLocalPosition(0.3, 1.1, 0.4);
    const props = {};
    const actions = new Actions({
      pc,
      stage,
      modelLibrary: {
        instantiate: (url) => (props[url] = new pc.Entity(url)),
      },
    });
    actions.sync({
      stagePhase: PHASE.SERVANT_ENTER,
      cargo: "table",
      installedCount: 0,
    },
    {
      entity,
      leftHand,
      rightHand,
    });
    const grip = props.table.getWorldTransform().transformPoint(new pc.Vec3(0, 1.069, -0.573));
    const midpoint = new pc.Vec3().lerp(leftHand.getPosition(), rightHand.getPosition(), 0.5);
    assert.ok(grip.distance(midpoint) < 0.00001, `yaw ${yaw}: ${grip.distance(midpoint)}`);
    stage.destroy();
    entity.destroy();
  }
});
