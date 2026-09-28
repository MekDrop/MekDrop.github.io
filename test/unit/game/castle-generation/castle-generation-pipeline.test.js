import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AbstractCastleGenerationStage } from "../../../../src/game/castle-generation/AbstractCastleGenerationStage.js";
import { createCastleGenerationPipeline } from "../../../../src/game/castle-generation/createCastleGenerationPipeline.js";
import { CastleGenerationStageRunNotImplementedError } from "../../../../src/game/errors/castle/index.js";

function createScheduler() {
  return {
    now: () => 0,
    throwIfAborted: () => {},
    yieldIfNeeded: async () => {},
    yieldToMainThread: async () => {},
  };
}

function createContext() {
  const cleanupCallbacks = [];
  return {
    output: {},
    scheduler: createScheduler(),
    yieldState: { lastYield: 0 },
    registerCleanup(callback) {
      cleanupCallbacks.push(callback);
    },
    cleanup() {
      for (const callback of cleanupCallbacks.splice(0).reverse()) {
        callback();
      }
    },
  };
}

class PipelineTestError extends Error {}

describe("castle generation pipeline", () => {
  it("awaits stages in their declared order", async () => {
    const events = [];

    class FirstStage extends AbstractCastleGenerationStage {
      async run() {
        events.push("first:start");
        await Promise.resolve();
        events.push("first:end");
      }
    }

    class SecondStage extends AbstractCastleGenerationStage {
      async run(context) {
        events.push("second");
        context.output.buildPlan = { complete: true };
      }
    }

    const generate = createCastleGenerationPipeline({
      createContext,
      createStages: () => [new FirstStage(), new SecondStage()],
    });

    assert.deepEqual(await generate({}), { complete: true });
    assert.deepEqual(events, ["first:start", "first:end", "second"]);
  });

  it("creates fresh stage instances and context state for every run", async () => {
    let nextStageId = 0;
    const contexts = [];

    class StatefulStage extends AbstractCastleGenerationStage {
      #id = ++nextStageId;

      async run(context) {
        contexts.push(context);
        context.output.buildPlan = { stageId: this.#id };
      }
    }

    const generate = createCastleGenerationPipeline({
      createContext,
      createStages: () => [new StatefulStage()],
    });

    assert.deepEqual(await generate({}), { stageId: 1 });
    assert.deepEqual(await generate({}), { stageId: 2 });
    assert.notEqual(contexts[0], contexts[1]);
    assert.notEqual(contexts[0].output, contexts[1].output);
  });

  it("runs context cleanup and skips remaining stages after failure", async () => {
    const events = [];

    class RegisterResourceStage extends AbstractCastleGenerationStage {
      async run(context) {
        events.push("registered");
        context.registerCleanup(() => events.push("cleaned"));
      }
    }

    class FailingStage extends AbstractCastleGenerationStage {
      async run() {
        events.push("failed");
        throw new PipelineTestError("stage failed");
      }
    }

    class SkippedStage extends AbstractCastleGenerationStage {
      async run() {
        events.push("skipped");
      }
    }

    const generate = createCastleGenerationPipeline({
      createContext,
      createStages: () => [
        new RegisterResourceStage(),
        new FailingStage(),
        new SkippedStage(),
      ],
    });

    await assert.rejects(generate({}), PipelineTestError);
    assert.deepEqual(events, ["registered", "failed", "cleaned"]);
  });

  it("uses a named game error for an unimplemented stage", async () => {
    await assert.rejects(
      new AbstractCastleGenerationStage().run({}),
      CastleGenerationStageRunNotImplementedError,
    );
  });
});
