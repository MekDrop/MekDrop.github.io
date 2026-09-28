import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GameCanvasScreenshotPlugin } from "../../../../../../src/game/plugins/game-canvas/screenshot/GameCanvasScreenshotPlugin.js";

describe("GameCanvasScreenshotPlugin", () => {
  it("owns the screenshot action and keyboard binding lifecycle", () => {
    const renderer = {};
    const registrations = [];
    let unregisterCount = 0;
    const plugin = new GameCanvasScreenshotPlugin({
      renderer: () => renderer,
      registerControlAction(name, action, options) {
        registrations.push({ name, action, options });
        return () => {
          unregisterCount += 1;
        };
      },
    });

    plugin.install();

    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].name, "copyScreenshot");
    assert.equal(registrations[0].action.constructor.name, "CopyScreenshotAction");
    assert.deepEqual(registrations[0].options, {
      binding: {
        keys: ["KeyS"],
        ctrlKey: true,
        allowRepeat: false,
      },
      keydown: true,
    });

    plugin.destroy();
    plugin.destroy();

    assert.equal(unregisterCount, 1);
  });
});
