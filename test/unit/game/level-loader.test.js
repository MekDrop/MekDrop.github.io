import assert from "node:assert/strict";
import { it } from "node:test";
import { LevelLoader } from "../../../src/game/LevelLoader.js";

it("isolates concurrent requests, propagates failures and terminates workers", async () => {
  const previousWorker = globalThis.Worker;
  const workers = [];
  class TestWorker {
    constructor(url, options) {
      assert.ok(url.pathname.endsWith("/LevelLoader.worker.js"));
      assert.equal(options.type, "module");
      workers.push(this);
    }
    postMessage(options) {
      this.options = options;
    }
    terminate() {
      this.terminated = true;
    }
  }
  globalThis.Worker = TestWorker;
  try {
    const first = LevelLoader.load({ mapName: "first" });
    const second = LevelLoader.load({ mapName: "second" });
    const map = { mapName: "second", pipeData: new Map() };
    workers[1].onmessage({ data: { map } });
    assert.equal(await second, map);
    assert.equal(workers[1].terminated, true);
    assert.equal(workers[0].terminated, undefined);
    const failure = new TypeError("generation failed");
    workers[0].onmessage({ data: { error: failure } });
    await assert.rejects(first, (error) => error === failure);
    assert.equal(workers[0].terminated, true);
    assert.deepEqual(workers[0].options, { mapName: "first" });
  } finally {
    globalThis.Worker = previousWorker;
  }
});
