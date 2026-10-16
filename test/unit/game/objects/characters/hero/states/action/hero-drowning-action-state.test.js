import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroDrowningActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroDrowningActionState.js";

for (const flowScale of [1, 1 / 2, 1 / 3]) {
  it(`carries a submerged hero at ${flowScale} of the original current`, () => {
    let velocity;
    const cell = {
      col: 1,
      row: 0,
      direction: "EAST",
      elevation: 2,
      flowScale,
    };
    const state = new HeroDrowningActionState();
    state.payload = {
      river: { cells: [cell] },
      targetIndex: 0,
      elapsed: 0,
      exiting: false,
    };
    state.execute({
      deltaTime: 0.1,
      feedback: {
        drowning: {
          position: () => ({
            x: 0,
            y: 1.5,
            z: 0,
          }),
          directionVector: () => ({
            x: 1,
            z: 0,
          }),
          routeEntryAt: () => ({ cell }),
          currentSpeed: 3,
          mapColumns: 1,
          mapRows: 1,
          waypointEpsilon: 0.02,
          submergeDepth: 0.5,
          sinkSpeed: 2,
          setVelocity: value => {
            velocity = value;
          },
        },
      },
    });
    assert.equal(velocity.x, 3 * flowScale);
    assert.equal(velocity.z, 0);
    assert.ok(Number.isFinite(velocity.y));
  });
}
