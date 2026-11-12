import assert from "node:assert/strict";
import { it } from "node:test";
import { CastlePlanLoader } from "../../../../../src/game/generator/castle/CastlePlanLoader.js";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";

const definition = {
  position: {
    x: 1,
    z: 2,
    width: 12,
    depth: 10,
  },
  doors: [{
    side: "NORTH",
    offset: 3,
    width: 2,
  }],
  basePlanId: "test-plan",
  buildPlan: { old: true },
};

it("sends only plan inputs to the worker and terminates it after use", async () => {
  const originalWorker = globalThis.Worker;
  let received, terminated = false;
  globalThis.Worker = class {
    postMessage(options) {
      received = options;
      queueMicrotask(() => this.onmessage({ data: { plan: { id: "new" } } }));
    }
    terminate() {
      terminated = true;
    }
  };
  try {
    assert.deepEqual(await CastlePlanLoader.generate(definition, 17), { id: "new" });
    assert.deepEqual(received, {
      position: definition.position,
      doors: definition.doors,
      basePlanId: "test-plan",
      requestedStyle: undefined,
      seed: 17,
    });
    assert.equal(terminated, true);
  } finally {
    globalThis.Worker = originalWorker;
  }
});

it("falls back to the original generator if a worker cannot start", async () => {
  const originalWorker = globalThis.Worker;
  const originalGenerate = CastleGenerator.generate;
  let received;
  globalThis.Worker = class {
    constructor() {
      throw new TypeError("Worker unavailable");
    }
  };
  CastleGenerator.generate = async (options) => {
    received = options;

    return { id: "fallback" };
  };
  try {
    assert.deepEqual(await CastlePlanLoader.generate(definition, 18), { id: "fallback" });
    assert.equal(received.seed, 18);
    assert.equal(received.position, definition.position);
  } finally {
    globalThis.Worker = originalWorker;
    CastleGenerator.generate = originalGenerate;
  }
});
