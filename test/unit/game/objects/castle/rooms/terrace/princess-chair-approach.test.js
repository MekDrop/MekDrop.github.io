import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../../../../src/game/enum/CastleTerracePhase.js";

const source = readFileSync(new URL("../../../../../../../src/game/objects/castle/rooms/terrace/TerraceRoyalActions.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");

class Motion {
  /**
   * @param {{actor: {entity: pc.Entity}}} options
   */
  constructor({ actor }) {
    this.home = actor.entity.getPosition().clone();
  }

  /**
   * @param {pc.Vec3} target
   */
  moveTo(target) {
    this.target = target.clone();
  }
}

const Actions = new Function("PHASE", "CastleResidentMotion", "CHARACTER_HEIGHT", "syncTerraceWalk", "terracePathYaw",
  `${source.replace("export class", "class")}\nreturn TerraceRoyalActions;`)(PHASE, Motion, 1.35, () => {}, () => 0);

it("approaches the chair from the sit clip's standing position at different stage scales", () => {
  for (const scale of [0.5, 1.7]) {
    const stage = new pc.Entity("Stage");
    stage.setLocalScale(scale, scale, scale);
    stage.setLocalEulerAngles(0, 73, 0);
    stage.setLocalPosition(3, 2, -4);
    const entity = new pc.Entity("Princess");
    let settlements = 0;
    const actor = {
      entity,
      sittingApproachDistance: 0.217,
      settleStandingPose: () => {
        settlements++;
      },
    };
    const actions = new Actions({
      RoyalType: { kind: "princess" },
      pc,
      stage,
      actor,
      navigation: {},
    });
    actions.sync({ stagePhase: PHASE.ROYAL_ENTER });
    const expected = stage.getWorldTransform().transformPoint(new pc.Vec3(-0.75, 0, 3.2))
      .add(stage.right.clone().mulScalar(actor.sittingApproachDistance));
    assert.ok(actions.motion.target.distance(expected) < 0.00001, "navigation ends in front of the seat, not inside it");
    actions.sync({ stagePhase: PHASE.ROYAL_EXIT });
    actions.sync({ stagePhase: PHASE.ROYAL_EXIT });
    assert.equal(settlements, 1, "transfer the stand-up offset once, before resuming navigation");
    stage.destroy();
    entity.destroy();
  }
});
