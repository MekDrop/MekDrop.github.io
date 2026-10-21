import assert from "node:assert/strict";
import { it } from "node:test";
import { SceneDecorationQueue } from "../../../../../src/game/rendering/scene/SceneDecorationQueue.js";

function mockFrames(t, frames) {
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  t.after(() => {
    if (previous) {
      globalThis.requestAnimationFrame = previous;
    } else {
      delete globalThis.requestAnimationFrame;
    }
  });
}

function mockTimers(t, timers, fallbacks = []) {
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const timer = () => {
      if (!timer.canceled) {
        callback();
      }
    };
    (delay ? fallbacks : timers).push(timer);

    return timer;
  });
  t.mock.method(globalThis, "clearTimeout", (timer) => {
    timer.canceled = true;
  });
}

it("uses the loading frame budget for several small jobs before yielding", async (t) => {
  const frames = [];
  const timers = [];
  mockFrames(t, frames);
  mockTimers(t, timers);
  let now = 0;
  t.mock.method(performance, "now", () => now += 4);
  const calls = [];
  const queue = new SceneDecorationQueue(assert.fail);
  for (let index = 0; index < 4; index++) {
    queue.add(() => {
      calls.push(index);
    });
  }
  const completion = queue.start();
  frames.shift()();
  timers.shift()();
  assert.deepEqual(calls, [0, 1, 2]);
  frames.shift()();
  timers.shift()();
  assert.equal(await completion, true);
  assert.deepEqual(calls, [0, 1, 2, 3]);
});

it("yields between loading frames, pauses, and cancels stale work", (t) => {
  const frames = [];
  const timers = [];
  const calls = [];
  let now = 0;
  mockTimers(t, timers);
  mockFrames(t, frames);
  t.mock.method(performance, "now", () => now += 13);
  const queue = new SceneDecorationQueue((error) => calls.push(error));
  queue.add(function* () {
    calls.push("grass-start");
    yield;
    calls.push("grass-end");
  });
  assert.deepEqual(calls, []);
  queue.start();
  queue.start();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(calls, [], "animation-frame callback does no heavy work before paint");
  timers.shift()();
  assert.deepEqual(calls, ["grass-start"]);
  queue.pause();
  frames.shift()();
  timers.shift()();
  assert.deepEqual(calls, ["grass-start"]);
  queue.start();
  frames.shift()();
  timers.shift()();
  assert.deepEqual(calls, ["grass-start", "grass-end"]);
  queue.add(() => calls.push("stale"));
  queue.pause();
  queue.start();
  queue.clear();
  queue.add(() => {
    calls.push("new-map");
  });
  queue.start();
  while (frames.length) {
    frames.shift()();
    timers.shift()();
  }
  assert.deepEqual(calls, ["grass-start", "grass-end", "new-map"]);
});

it("keeps loading pending until every decoration finishes and releases canceled waiters", async (t) => {
  const frames = [];
  const timers = [];
  mockFrames(t, frames);
  mockTimers(t, timers);
  let now = 0;
  t.mock.method(performance, "now", () => now += 13);
  const queue = new SceneDecorationQueue(assert.fail);
  let decorated = false;
  queue.add(function* () {
    yield;
    decorated = true;
  });
  const completion = queue.start();
  let ready = false;
  void completion.then((completed) => {
    ready = completed;
  });
  frames.shift()();
  timers.shift()();
  await Promise.resolve();
  assert.equal(ready, false);
  assert.equal(decorated, false);
  frames.shift()();
  timers.shift()();
  assert.equal(await completion, true);
  assert.equal(decorated, true);
  assert.equal(ready, true);

  queue.add(() => {});
  const superseded = queue.start();
  queue.pause();
  assert.equal(await superseded, false);
  const removed = queue.start();
  queue.clear();
  assert.equal(await removed, false);
  assert.equal(await queue.start(), true, "an empty scene is already complete");
});

it("reports decoration errors and allows remaining jobs to finish", (t) => {
  const frames = [];
  const timers = [];
  const errors = [];
  mockFrames(t, frames);
  mockTimers(t, timers);
  const queue = new SceneDecorationQueue((error) => errors.push(error));
  const failure = new TypeError("decoration fixture");
  let finished = false;
  queue.add(() => {
    throw failure;
  });
  queue.add(() => {
    finished = true;
  });
  queue.start();
  while (frames.length) {
    frames.shift()();
    timers.shift()();
  }
  assert.deepEqual(errors, [failure]);
  assert.equal(finished, true);
});

it("finishes loading with suspended animation frames and ignores the late frame", async (t) => {
  const frames = [];
  const timers = [];
  const fallbacks = [];
  mockFrames(t, frames);
  mockTimers(t, timers, fallbacks);
  const queue = new SceneDecorationQueue(assert.fail);
  let calls = 0;
  queue.add(() => {
    calls++;
  });
  const completion = queue.start();
  assert.equal(frames.length, 1);
  fallbacks.shift()();
  assert.equal(await completion, true);
  assert.equal(calls, 1);
  frames.shift()();
  timers.shift()();
  assert.equal(calls, 1, "a delayed animation frame cannot run the same chunk twice");
});
