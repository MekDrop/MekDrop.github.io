import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroMovementAction } from "../../src/game/actions/HeroMovementAction.js";

function controls(context, dodgeAccepted = true) {
  let now = 0;
  context.mock.method(performance, "now", () => now);
  const movements = [];
  const dodges = [];
  let facingHoldDuration = 0;
  const renderer = {
    inventoryVisible: false,
    hero: {
      get facingHoldDuration() {
        return facingHoldDuration;
      },
      set facingHoldDuration(duration) {
        facingHoldDuration = duration;
      },
      setMovement: (...args) => movements.push(args),
      dodge: (...args) => {
        dodges.push(args);
        return dodgeAccepted;
      },
    },
  };
  const action = new HeroMovementAction(renderer);
  return {
    action,
    renderer,
    movements,
    dodges,
    press(time, repeat = false) {
      now = time;
      action.pressDirection("down", { repeat, shiftKey: false }, 0.28);
    },
  };
}

it("holds backward facing during double-tap detection without delaying movement", (context) => {
  const input = controls(context);
  input.press(0);
  assert.equal(input.renderer.hero.facingHoldDuration, 0.28);
  assert.deepEqual(input.movements.at(-1), [0, -1, false]);
  input.action.releaseDirection("down");
  input.press(210);
  assert.deepEqual(input.dodges, [[0, -1, "down"]]);
});

it("consumes dodge key repeats until release, then accepts fresh movement", (context) => {
  const input = controls(context);
  input.press(0);
  input.action.releaseDirection("down");
  input.press(210);
  const movementCount = input.movements.length;
  input.press(400, true);
  input.press(800, true);
  assert.equal(input.movements.length, movementCount);
  assert.deepEqual(input.movements.at(-1), [0, 0, false]);
  input.action.releaseDirection("down");
  input.press(900);
  assert.deepEqual(input.movements.at(-1), [0, -1, false]);
});

it("allows normal movement when the backward dodge is refused", (context) => {
  const input = controls(context, false);
  input.press(0);
  input.action.releaseDirection("down");
  input.press(210);
  assert.equal(input.dodges.length, 1);
  assert.deepEqual(input.movements.at(-1), [0, -1, false]);
  input.action.releaseDirection("down");
  assert.deepEqual(input.movements.at(-1), [0, 0, false]);
});

it("clears consumed keys and pending facing holds when controls are reset", (context) => {
  const input = controls(context);
  input.press(0);
  input.action.releaseDirection("down");
  input.press(210);
  input.action.clear();
  assert.equal(input.renderer.hero.facingHoldDuration, 0);
  input.press(300);
  assert.equal(input.dodges.length, 1);
  assert.deepEqual(input.movements.at(-1), [0, -1, false]);
});
