import assert from "node:assert/strict";
import { test } from "node:test";
import { EventHandler } from "playcanvas";
import { GameFrameLoop } from "../../../../src/game/rendering/GameFrameLoop.js";

test("loading cancels engine frames and resumes with a zero-delta first frame", () => {
  const cancelled = [];
  const previous = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = id => cancelled.push(id);
  try {
    const app = new EventHandler();
    app.frameRequestId = 12;
    app.timeScale = 0.75;
    let requests = 0;
    app.requestAnimationFrame = () => {
      app.frameRequestId = ++requests;
    };
    const loop = new GameFrameLoop(app);
    loop.pause();
    loop.pause();
    assert.deepEqual(cancelled, [12]);
    assert.equal(app.frameRequestId, null);
    loop.resume();
    loop.resume();
    assert.equal(requests, 1);
    assert.equal(app.timeScale, 0);
    app.fire("frameend");
    assert.equal(app.timeScale, 0.75);
    loop.pause();
    loop.resume();
    loop.pause();
    assert.equal(app.timeScale, 0.75);
    assert.equal(app.frameRequestId, null);
    app.fire("frameend");
    assert.equal(app.timeScale, 0.75);
  } finally {
    globalThis.cancelAnimationFrame = previous;
  }
});
