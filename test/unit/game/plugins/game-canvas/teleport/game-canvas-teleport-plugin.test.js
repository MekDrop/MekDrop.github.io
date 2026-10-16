import assert from "node:assert/strict";
import { it } from "node:test";
import { GameCanvasTeleportPlugin } from "../../../../../../src/game/plugins/game-canvas/teleport/GameCanvasTeleportPlugin.js";

it("registers a double-click control, follows debug state, and unregisters once", () => {
  const debugStore = { hasAny: false };
  let registration;
  let unregisterCount = 0;
  const received = [];
  const plugin = new GameCanvasTeleportPlugin({
    debugStore,
    renderer: () => ({
      teleportHeroAtPointer: (event) => {
        received.push(event);

        return true;
      },
    }),
    registerControlAction: (name, action, options) => {
      registration = {
        name,
        action,
        options,
      };

      return () => {
        unregisterCount += 1;
      };
    },
  });
  plugin.install();
  assert.equal(registration.name, "teleportHero");
  assert.deepEqual(registration.options, { doubleClick: true });
  const event = {
    button: 0,
    clientX: 100,
    clientY: 200,
  };
  assert.equal(registration.action.invoke(event), false);
  debugStore.hasAny = true;
  assert.equal(registration.action.invoke({ button: 2 }), false);
  assert.equal(registration.action.invoke(event), true);
  debugStore.hasAny = false;
  assert.equal(registration.action.invoke(event), false);
  assert.deepEqual(received, [event]);
  plugin.destroy();
  plugin.destroy();
  assert.equal(unregisterCount, 1);
});
