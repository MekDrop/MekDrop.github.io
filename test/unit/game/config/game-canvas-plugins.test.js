import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadGameCanvasPluginConfig } from "../../../../src/game/config/game-canvas-plugins/index.js";

describe("game canvas plugin configuration", () => {
  it("keeps production limited to default plugins", async () => {
    const entries = await loadGameCanvasPluginConfig({
      translate: (key) => `translated:${key}`,
    });

    assert.deepEqual(
      entries.map(({ exportName }) => exportName),
      ["GameCanvasRecordingPlugin"],
    );
    assert.equal(
      entries[0].messages.active,
      "translated:game.recording.active",
    );
  });

  it("adds development-only plugins with declarative activation rules", async () => {
    const entries = await loadGameCanvasPluginConfig({ development: true });
    const byName = new Map(entries.map((entry) => [entry.exportName, entry]));

    assert.deepEqual([...byName.keys()], [
      "GameCanvasRecordingPlugin",
      "GameCanvasDebugUiPlugin",
      "GameCanvasMovementTestDriverPlugin",
      "GameCanvasCameraTestDriverPlugin",
    ]);
    assert.deepEqual(byName.get("GameCanvasMovementTestDriverPlugin").requires, {
      testMapLoaded: true,
    });
    assert.equal(
      byName.get("GameCanvasCameraTestDriverPlugin").queryParameter,
      "camera-test",
    );
  });
});
