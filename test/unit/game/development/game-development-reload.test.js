import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { GameDevelopmentReload } from "../../../../src/game/development/GameDevelopmentReload.js";
import { GameHotReload } from "../../../../src/game/development/GameHotReload.js";

function fixture(overrides = {}) {
  const calls = [];
  const map = {
    mapName: "test_chairs",
    objects: [{ object: "Chair" }],
  };
  const reload = new GameDevelopmentReload({
    whenReady: async () => {},
    getMap: () => map,
    reloadHuds: classes => calls.push(["hud", classes]),
    reloadObjects: async names => {
      calls.push(["objects", names]);

      return true;
    },
    reloadMap: async name => calls.push(["map", name]),
    onError: error => calls.push(["error", error]),
    ...overrides,
  });

  return {
    reload,
    calls,
    map,
  };
}

test("absent objects and inactive maps never rebuild the current view", async t => {
  const { reload, calls } = fixture();
  t.after(() => reload.destroy());
  GameHotReload.publish({
    objects: ["SignalBell"],
    maps: ["test_other"],
  });
  await delay(100);
  assert.deepEqual(calls.filter(([type]) => type !== "hud"), []);
});

test("one Vite batch coalesces object updates and updates only the latest HUD", async t => {
  const { reload, calls } = fixture();
  t.after(() => reload.destroy());
  const first = class CoinHud {};
  const latest = class CoinHud {};
  GameHotReload.publish({
    objects: ["Chair"],
    huds: [first],
  });
  GameHotReload.publish({
    objects: ["Chair"],
    huds: [latest],
  });
  await delay(100);
  assert.deepEqual(calls, [["hud", [latest]], ["objects", ["Chair"]]]);
});

test("stateful objects fall back to one map rebuild; changed JSON takes priority", async t => {
  const { reload, calls } = fixture({ reloadObjects: async () => false });
  t.after(() => reload.destroy());
  GameHotReload.publish({ objects: ["Chair"] });
  await delay(100);
  assert.deepEqual(calls.at(-1), ["map", "test_chairs"]);
  calls.length = 0;
  GameHotReload.publish({
    maps: ["test_chairs"],
    objects: ["Chair"],
  });
  await delay(100);
  assert.deepEqual(calls, [["hud", []], ["map", "test_chairs"]]);
});

test("navigation finishes before deciding which map is affected", async t => {
  let ready;
  const waiting = new Promise(resolve => {
    ready = resolve;
  });
  const { reload, calls, map } = fixture({ whenReady: () => waiting });
  t.after(() => reload.destroy());
  GameHotReload.publish({ objects: ["Chair"] });
  await delay(80);
  assert.deepEqual(calls, []);
  map.objects = [{ object: "SignalBell" }];
  ready();
  await delay(20);
  assert.deepEqual(calls, [["hud", []]]);
});

test("unmount removes subscriptions and cancels pending updates", async () => {
  const { reload, calls } = fixture();
  GameHotReload.publish({ maps: ["test_chairs"] });
  reload.destroy();
  GameHotReload.publish({ maps: ["test_chairs"] });
  await delay(100);
  assert.deepEqual(calls, []);
});

test("navigation started during asset loading is not replaced by an old map reload", async t => {
  let finishAssets;
  let finishNavigation;
  let navigation = Promise.resolve();
  const assets = new Promise(resolve => {
    finishAssets = resolve;
  });
  let current;
  const { reload, calls, map } = fixture({
    whenReady: () => navigation,
    getMap: () => current,
    reloadObjects: () => assets,
  });
  current = map;
  t.after(() => reload.destroy());
  GameHotReload.publish({ objects: ["Chair"] });
  await delay(80);
  navigation = new Promise(resolve => {
    finishNavigation = resolve;
  });
  finishAssets(false);
  await delay(20);
  current = {
    mapName: "test_other",
    objects: [],
  };
  finishNavigation();
  await delay(20);
  assert.deepEqual(calls, [["hud", []]]);
});

test("a failed update is reported and later updates still work", async t => {
  const failure = new TypeError("broken development object");
  let attempts = 0;
  const { reload, calls } = fixture({
    reloadObjects: async () => {
      if (attempts++ === 0) {
        throw failure;
      }
      return false;
    },
  });
  t.after(() => reload.destroy());
  GameHotReload.publish({ objects: ["Chair"] });
  await delay(100);
  assert.deepEqual(calls.at(-1), ["error", failure]);
  GameHotReload.publish({ objects: ["Chair"] });
  await delay(100);
  assert.deepEqual(calls.at(-1), ["map", "test_chairs"]);
});
