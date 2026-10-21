import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec2 } from "playcanvas";
import { DigInteraction } from "../../../../../src/game/objects/treasure/DigInteraction.js";

it("selects the throw animation and soil destination from the supported pile after positioning", () => {
  for (const side of [1, -1]) {
    let options;
    const tool = { useAnimation: (context) => context.oppositeThrow ? "DigOpposite" : "Dig" };
    const facing = {
      x: 0,
      z: 1,
    };
    let deposits = 0;
    const field = {
      depositDigSoil: () => {
        deposits += 1;
      },
      canDig: () => true,
      dig: () => false,
      pileOffsetFor: (target, actualFacing) => {
        assert.equal(actualFacing, facing);

        return new Vec2(side * 0.42, side * 0.3);
      },
    };
    const interaction = new DigInteraction({
      field,
      target: {
        kind: "dig",
        id: "edge",
      },
      hero: {
        facingDirection: facing,
        useTool: (selected, action) => {
          assert.equal(selected, tool);
          options = action;

          return true;
        },
      },
      tool,
    });
    assert.equal(interaction.interact(), true);
    const action = { toolContext: { ...options.context } };
    options.onImpact(action);
    assert.equal(deposits, 0);
    options.onSoilReleased();
    assert.equal(deposits, 1);
    assert.equal(action.useAnimation, side === -1 ? "DigOpposite" : "Dig");
    assert.equal(action.toolContext.pileOffsetX, side * 0.42);
    assert.equal(action.toolContext.pileOffsetZ, side * 0.3);
  }
});
