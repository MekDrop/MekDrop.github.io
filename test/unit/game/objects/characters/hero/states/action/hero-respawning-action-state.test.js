import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroActionBehavior } from "../../../../../../../../src/game/objects/characters/hero/behaviors/action/HeroActionBehavior.js";

/**
 * @param {number} [lives]
 */
function fixture(lives = 3) {
  const events = [];
  const progress = [];
  const status = {
    lives,
    deaths: 0,
    fallFinished: false,
  };
  const presentation = {
    facingYaw: 25,
    baseHeight: 1,
    effect: {
      begin: (yaw, height) => events.push(["effect-begin", yaw, height]),
      update: (...args) => progress.push(args),
      reset: () => events.push("effect-reset"),
    },
  };
  const behavior = new HeroActionBehavior({
    feedback: {
      falling: {
        begin: () => events.push("fall"),
        finished: () => status.fallFinished,
      },
      death: {
        consumeLife: () => {
          status.deaths += 1;
          status.lives = Math.max(0, status.lives - 1);
          events.push(["life-published", status.lives]);

          return status.lives;
        },
      },
      burning: {
        lives: () => status.lives,
        modelScale: 0.65,
        freezeAtHeight: () => {},
        setHeight: () => {},
        setModelScale: () => {},
        syncState: () => {},
      },
      respawning: {
        duration: 1.55,
        prepare: () => {
          events.push("restore-spawn");
          presentation.baseHeight = 4;
        },
        presentation: () => presentation,
        begin: () => events.push("respawn-published"),
        complete: () => events.push("restart-animation"),
      },
      gameOver: { begin: () => events.push("game-over") },
    },
  });

  return {
    behavior,
    events,
    progress,
    status,
    presentation,
  };
}

for (const cause of ["fall", "lava"]) {
  for (const lives of [1, 3]) {
    it(`resolves ${cause} with ${lives} lives, consuming exactly one life before transition`, () => {
      const { behavior, status, events } = fixture(lives);
      if (cause === "fall") {
        behavior.fallingToDeath = true;
        behavior.update(0.1);
        assert.equal(status.deaths, 0);
        status.fallFinished = true;
      } else {
        behavior.lavaDeathAction = { cell: { elevation: 2 } };
      }
      events.length = 0;
      behavior.update(5);
      assert.equal(status.deaths, 1);
      assert.deepEqual(events[0], ["life-published", lives - 1]);
      assert.equal(behavior.respawning, lives > 1);
      assert.equal(behavior.gameOver, lives === 1);
      assert.equal(behavior.ashes, cause === "lava" && lives === 1);
      if (lives > 1) {
        assert.deepEqual(events.slice(1), [
          "restore-spawn",
          ["effect-begin", 25, 4],
          "respawn-published",
        ]);
      } else {
        assert.deepEqual(events.slice(1), ["game-over"]);
      }
      behavior.update(5);
      assert.equal(status.deaths, 1);
    });
  }
}

it("updates live presentation resources and resets before completing a slow respawn frame", () => {
  const { behavior, events, progress, presentation } = fixture();
  behavior.respawnAction = { elapsed: 0 };
  behavior.update(0.31);
  behavior.present();
  assert.ok(Math.abs(progress[0][0] - 0.2) < 1e-12);
  assert.deepEqual(progress[0].slice(1), [0.31, 4]);
  presentation.baseHeight = 8;
  presentation.effect = {
    update: (...args) => progress.push(args),
    reset: () => events.push("replacement-reset"),
  };
  behavior.present();
  assert.deepEqual(progress[1].slice(1), [0.31, 8]);
  events.length = 0;
  behavior.update(5);
  behavior.update(5);
  assert.equal(behavior.respawning, false);
  assert.deepEqual(events, ["replacement-reset", "restart-animation"]);
});

it("resets presentation on interrupted respawn without running successful completion", () => {
  const { behavior, events, status } = fixture();
  behavior.respawnAction = { elapsed: 0 };
  events.length = 0;
  behavior.endGame();
  assert.deepEqual(events, ["effect-reset", "game-over"]);
  assert.equal(status.deaths, 0);
});

it("retains the dying-timeout recovery path without consuming a life", (context) => {
  context.mock.method(console, "error", () => {});
  const { behavior, status, events } = fixture();
  behavior.fallingToDeath = true;
  behavior.update(10.01);
  assert.equal(behavior.respawning, true);
  assert.equal(status.deaths, 0);
  assert.deepEqual(events.slice(1), [
    "restore-spawn",
    ["effect-begin", 25, 4],
    "respawn-published",
  ]);
});
