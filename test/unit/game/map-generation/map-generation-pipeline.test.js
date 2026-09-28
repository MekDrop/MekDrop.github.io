import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MapGenerationStageRunNotImplementedError } from "../../../../src/game/errors/map/index.js";
import { AbstractMapGenerationStage } from "../../../../src/game/map-generation/AbstractMapGenerationStage.js";
import { createMapGenerationPipeline } from "../../../../src/game/map-generation/createMapGenerationPipeline.js";

function createScheduler() {
  return {
    now: () => 0,
    yieldIfNeeded: async () => {},
    yieldToMainThread: async () => {},
  };
}

class PipelineTestError extends Error {}

describe("map generation pipeline", () => {
  it("awaits stages in their declared order", async () => {
    const events = [];

    class FirstStage extends AbstractMapGenerationStage {
      async run() {
        events.push("first:start");
        await Promise.resolve();
        events.push("first:end");
      }
    }

    class SecondStage extends AbstractMapGenerationStage {
      async run(context) {
        events.push("second");
        context.output.mapData = { complete: true };
      }
    }

    const generate = createMapGenerationPipeline({
      createContext: () => ({
        output: {},
        scheduler: createScheduler(),
        yieldState: { lastYield: 0 },
      }),
      createStages: () => [new FirstStage(), new SecondStage()],
    });

    assert.deepEqual(await generate({}), { complete: true });
    assert.deepEqual(events, ["first:start", "first:end", "second"]);
  });

  it("creates fresh stage instances and context state for every run", async () => {
    let nextStageId = 0;
    const contexts = [];

    class StatefulStage extends AbstractMapGenerationStage {
      #id = ++nextStageId;

      async run(context) {
        contexts.push(context);
        context.output.mapData = { stageId: this.#id };
      }
    }

    const generate = createMapGenerationPipeline({
      createContext: () => ({
        output: {},
        scheduler: createScheduler(),
        yieldState: { lastYield: 0 },
      }),
      createStages: () => [new StatefulStage()],
    });

    assert.deepEqual(await generate({}), { stageId: 1 });
    assert.deepEqual(await generate({}), { stageId: 2 });
    assert.notEqual(contexts[0], contexts[1]);
    assert.notEqual(contexts[0].output, contexts[1].output);
  });

  it("stops at the first failed stage and preserves its error", async () => {
    const events = [];

    class SuccessfulStage extends AbstractMapGenerationStage {
      async run() {
        events.push("successful");
      }
    }

    class FailingStage extends AbstractMapGenerationStage {
      async run() {
        events.push("failing");
        throw new PipelineTestError("stage failed");
      }
    }

    class SkippedStage extends AbstractMapGenerationStage {
      async run() {
        events.push("skipped");
      }
    }

    const generate = createMapGenerationPipeline({
      createContext: () => ({
        output: {},
        scheduler: createScheduler(),
        yieldState: { lastYield: 0 },
      }),
      createStages: () => [
        new SuccessfulStage(),
        new FailingStage(),
        new SkippedStage(),
      ],
    });

    await assert.rejects(generate({}), PipelineTestError);
    assert.deepEqual(events, ["successful", "failing"]);
  });

  it("uses a named game error for an unimplemented stage", async () => {
    await assert.rejects(
      new AbstractMapGenerationStage().run({}),
      MapGenerationStageRunNotImplementedError,
    );
  });
});
