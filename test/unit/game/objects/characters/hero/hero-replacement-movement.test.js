import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(
  new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url),
  "utf8",
);
const start = source.indexOf("  continueMovementFrom(previousHero) {");
const end = source.indexOf("\n  }", start) + "\n  }".length;
const method = source.slice(start, end).replaceAll("#", "_");
const Driver = new Function(`return class { ${method} }`)();

it("hands off the latest live motion instead of the trigger-time spawn", () => {
  const previous = new Driver();
  const next = new Driver();
  previous._position = {
    x: 7,
    y: 2,
    z: -10,
  };
  previous._velocity = {
    x: 3,
    y: 0,
    z: -1,
  };
  previous._input = {
    x: 1,
    y: 0,
  };
  previous._running = true;
  previous._facingYaw = 90;
  previous._grounded = true;
  previous._coyoteRemaining = 0.1;
  previous._jumpsUsed = 0;
  previous._jumpMovement = false;
  previous._stableGroundPosition = { ...previous._position };
  next._input = { copy: (input) => Object.assign(next._input, input) };
  let resumed = null;
  next._physics = {
    resume: (position, velocity) => {
      resumed = {
        position,
        velocity,
      };
    },
  };
  next._syncIslandVisualPosition = () => {};
  next._syncState = () => {};

  next.continueMovementFrom(previous);

  assert.deepEqual(resumed.position, previous._position);
  assert.deepEqual(resumed.velocity, previous._velocity);
  assert.notEqual(next._position, previous._position);
  assert.equal(next._input.x, 1);
  assert.equal(next._running, true);
  assert.equal(next._facingYaw, 90);
  assert.equal(next._grounded, true);
  assert.equal(next._coyoteRemaining, 0.1);
});
