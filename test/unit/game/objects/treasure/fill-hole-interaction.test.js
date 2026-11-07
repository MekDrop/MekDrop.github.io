import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec2 } from "playcanvas";
import { FillHoleInteraction } from "../../../../../src/game/objects/treasure/FillHoleInteraction.js";

it("selects the scoop side from the stored pile when starting and resuming", () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const x = Math.sin(yaw);
    const z = Math.cos(yaw);
    for (const side of [1, -1]) {
      let context;
      const offset = new Vec2((z * 0.42 + x * 0.3) * side, (-x * 0.42 + z * 0.3) * side);
      const field = {
        canFill: () => true,
        isFillRimStage: () => false,
        fillPileOffsetFor: () => offset.clone(),
      };
      const hero = {
        position: {
          x: -x * 0.535,
          z: -z * 0.535,
        },
        useTool: (tool, options) => {
          context = options.context;

          return true;
        },
      };
      const interaction = new FillHoleInteraction({
        field,
        hero,
        tool: {},
        target: {
          id: "hole",
          x: 0,
          y: 0,
          z: 0,
        },
      });
      assert.equal(interaction.interact(), true);
      assert.equal(context.action, "fill");
      assert.equal(context.oppositeFill, side === -1);
      hero.position.x *= -1;
      hero.position.z *= -1;
      assert.equal(interaction.interact(), true);
      assert.equal(context.oppositeFill, side === 1,
        "resuming from the other side uses the unchanged pile position");
      field.isFillRimStage = () => true;
      interaction.interact();
      assert.equal(context.action, "level-hole");
    }
  }
});
