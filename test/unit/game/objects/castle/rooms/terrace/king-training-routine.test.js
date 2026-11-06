import assert from "node:assert/strict";
import { it } from "node:test";
import { KING_ANIMATION as ANIMATION } from "../../../../../../../src/game/enum/KingAnimation.js";
import { KingTrainingRoutine } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTrainingRoutine.js";
import { KingTerracePerformance } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTerracePerformance.js";

it("slows with fatigue and finishes the drill before sitting down", () => {
  const stamina = new KingTrainingRoutine({
    random: () => 0,
    trainingSeconds: 0.5,
  });
  assert.equal(stamina.speed, 1);
  stamina.update(0.25, ANIMATION.SWORD_COMBINATION, 1);
  assert.equal(stamina.stamina, 0.5);
  assert.ok(stamina.speed > 0.45 && stamina.speed < 1);
  stamina.update(0.25, ANIMATION.SWORD_COMBINATION, 2);
  assert.equal(stamina.stamina, 0);
  assert.equal(stamina.speed, 0.45);
  assert.equal(stamina.clip, ANIMATION.SWORD_COMBINATION);
  stamina.update(0.1, ANIMATION.SWORD_COMBINATION, 6.1);
  assert.equal(stamina.clip, ANIMATION.SWORD_COMBINATION);
  stamina.update(0.1, ANIMATION.SWORD_COMBINATION, 20);
  assert.equal(stamina.clip, ANIMATION.GROUND_SIT_DOWN);
});

it("recovers only while seated and stands fully before restarting", () => {
  const stamina = new KingTrainingRoutine({
    random: () => 0,
    recoverySeconds: 0.5,
  });
  stamina.stamina = 0;
  stamina.update(0, ANIMATION.SWORD_COMBINATION, 6.1);
  stamina.update(0, ANIMATION.SWORD_COMBINATION, 149 / 24);
  stamina.update(0.25, ANIMATION.GROUND_SIT_DOWN, 1.4);
  assert.equal(stamina.stamina, 0);
  assert.equal(stamina.clip, ANIMATION.GROUND_SIT_DOWN);
  stamina.update(0.1, ANIMATION.GROUND_SIT_DOWN, 1.5);
  assert.equal(stamina.clip, ANIMATION.GROUND_REST);
  stamina.update(0.25, ANIMATION.GROUND_SIT_DOWN, 1.5);
  assert.equal(stamina.stamina, 0);
  stamina.update(0.25, ANIMATION.GROUND_REST, 0.25);
  assert.equal(stamina.stamina, 0.5);
  assert.equal(stamina.clip, ANIMATION.GROUND_REST);
  stamina.update(0, ANIMATION.GROUND_REST, 0.25);
  assert.equal(stamina.stamina, 0.5, "paused training does not recover");
  stamina.update(0.25, ANIMATION.GROUND_REST, 0.5);
  assert.equal(stamina.clip, ANIMATION.GROUND_STAND_UP);
  assert.equal(stamina.stamina, 1);
  stamina.update(0.1, ANIMATION.GROUND_STAND_UP, 1.4);
  assert.equal(stamina.clip, ANIMATION.GROUND_STAND_UP);
  stamina.update(0.1, ANIMATION.GROUND_STAND_UP, 1.5);
  assert.equal(stamina.clip, ANIMATION.ADVANCE_RETREAT);
  assert.equal(stamina.speed, 1);
});

it("gets up on cancellation without granting free stamina", () => {
  const stamina = new KingTrainingRoutine({ random: () => 0 });
  stamina.stamina = 0;
  stamina.update(0, ANIMATION.SWORD_COMBINATION, 6.1);
  stamina.update(0, ANIMATION.SWORD_COMBINATION, 149 / 24);
  stamina.update(0, ANIMATION.GROUND_SIT_DOWN, 1.5);
  stamina.finish();
  assert.equal(stamina.clip, ANIMATION.GROUND_STAND_UP);
  assert.equal(stamina.stamina, 0);
  stamina.update(0, ANIMATION.GROUND_STAND_UP, 1.5);
  assert.equal(stamina.clip, ANIMATION.ADVANCE_RETREAT);
  assert.equal(stamina.stamina, 0);
});

it("uses the slowed animation clock for the complete fatigue, rest, and resume cycle", () => {
  const performance = new KingTerracePerformance({ random: () => 0 });
  performance.stamina = 0.02;
  let clip = ANIMATION.SWORD_COMBINATION;
  let elapsed = 3;
  const transitions = [];
  let resumed = false;
  for (let time = 0; time < 80; time += 1 / 60) {
    const sample = performance.sample("sword", time, 1, {
      clip,
      time: elapsed,
    });
    if (sample.clip !== clip) {
      transitions.push(sample.clip);
      clip = sample.clip;
      elapsed = 0;
      if (clip === ANIMATION.ADVANCE_RETREAT) {
        assert.equal(performance.stamina, 1);
        assert.equal(sample.speed, 1);
        resumed = true;
        break;
      }
    }
    elapsed += sample.speed / 60;
    if (clip === ANIMATION.SWORD_COMBINATION) {
      elapsed = Math.min(elapsed, 149 / 24);
    } else if (clip === ANIMATION.GROUND_REST) {
      elapsed %= 2.5;
    } else {
      elapsed = Math.min(1.5, elapsed);
    }
  }
  assert.equal(resumed, true);
  assert.deepEqual(transitions, [ANIMATION.GROUND_SIT_DOWN, ANIMATION.GROUND_REST,
    ANIMATION.GROUND_STAND_UP, ANIMATION.ADVANCE_RETREAT]);
});

import { KingTrainingClips } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTrainingClips.js";
it("randomly chooses complete exercise states without immediate repeats", () => {
  let calls = 0;
  const routine = new KingTrainingRoutine({
    random: () => {
      calls++;

      return ((calls * 37) % 101) / 101;
    },
  });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const clip = routine.clip; seen.add(clip); assert.match(routine.stateName, /^King.+State$/);
    routine.update(0, clip, KingTrainingClips.duration(clip) / 2);
    assert.equal(calls, i + 1); assert.equal(routine.clip, clip);
    routine.update(0, clip, KingTrainingClips.duration(clip));
    assert.notEqual(routine.clip, clip); assert.equal(calls, i + 2);
  }
  assert.equal(seen.size, 5);
});

import { KingTrainingBehavior } from "../../../../../../../src/game/objects/castle/residents/KingTrainingBehavior.js";
import { KingCombatTrainingState } from "../../../../../../../src/game/objects/castle/states/terrace/king/KingCombatTrainingState.js";
it("reports the actual exercise and recovery as the resident state", () => {
  const routine = new KingTrainingRoutine({ random: () => 0 });
  const behavior = new KingTrainingBehavior();
  behavior.trainingRoutine = routine;
  behavior.transition(KingCombatTrainingState.name);
  assert.equal(behavior.state.name, "KingSwordCombinationState");
  assert.equal(behavior.animation, routine.clip);
  routine.stamina = 0;
  routine.update(0, routine.clip, KingTrainingClips.duration(routine.clip));
  assert.equal(behavior.state.name, "KingGroundSitDownState");
  assert.equal(behavior.state.resting, true);
});
