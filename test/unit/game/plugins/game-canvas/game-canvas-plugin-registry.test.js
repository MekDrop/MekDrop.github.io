import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GameCanvasPluginRegistry } from "../../../../../src/game/plugins/game-canvas/GameCanvasPluginRegistry.js";

describe("GameCanvasPluginRegistry", () => {
  it("loads and unloads configured plugins as their activation changes", async () => {
    const events = [];
    class AlwaysPlugin {
      install() {
        events.push("always:install");
      }

      beforeRender() {
        events.push("always:before-render");
      }

      destroy() {
        events.push("always:destroy");
      }
    }

    class OptionalPlugin {
      install() {
        events.push("optional:install");
      }

      afterRender(mapData) {
        events.push(`optional:after-render:${mapData.mapName}`);
      }

      destroy() {
        events.push("optional:destroy");
      }
    }

    const registry = new GameCanvasPluginRegistry({
      target: { location: { search: "" } },
      pluginModules: {
        "/always.js": async () => ({ AlwaysPlugin }),
        "/optional.js": async () => ({ OptionalPlugin }),
      },
    });
    registry.configure([
      {
        module: "/always.js",
        exportName: "AlwaysPlugin",
      },
      {
        module: "/optional.js",
        exportName: "OptionalPlugin",
        requires: { optionalEnabled: true },
      },
    ]);

    await registry.refresh();
    assert.ok(registry.get("AlwaysPlugin") instanceof AlwaysPlugin);
    assert.equal(registry.get("OptionalPlugin"), null);

    registry.setState({ optionalEnabled: true });
    await registry.refresh();
    registry.beforeRender();
    registry.afterRender({ mapName: "configured" });
    assert.ok(registry.get("OptionalPlugin") instanceof OptionalPlugin);

    registry.setState({ optionalEnabled: false });
    await registry.refresh();
    assert.equal(registry.get("OptionalPlugin"), null);

    registry.destroy();
    assert.deepEqual(events, [
      "always:install",
      "optional:install",
      "always:before-render",
      "optional:after-render:configured",
      "optional:destroy",
      "always:destroy",
    ]);
  });

  it("rejects duplicate plugin ids", () => {
    const registry = new GameCanvasPluginRegistry({ pluginModules: {} });
    const entry = {
      module: "/duplicate.js",
      exportName: "DuplicatePlugin",
    };

    assert.throws(
      () => registry.configure([entry, entry]),
      /Duplicate game canvas plugin id: DuplicatePlugin/,
    );
  });
});
