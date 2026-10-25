import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import createPlugin from "../../../../scripts/game-hmr/vite-plugin.cjs";
import { parse } from "acorn";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const game = root.replaceAll("\\", "/").replace(/\/$/, "") + "/src/game";

function transform(file) {
  const source = readFileSync(new URL(`../../../../src/game/${file}`, import.meta.url), "utf8");

  return createPlugin(root).transform(source, game + "/" + file);
}

function boundary(code, context = {}) {
  let dependencies;
  let callback;
  const updates = [];
  const invalidations = [];
  const suffix = code.slice(code.lastIndexOf('\nimport { GameHotReload }'))
    .replace(/import \{ GameHotReload \}[^;]+;/, "")
    .replaceAll("import.meta.hot", "hot");
  runInNewContext(suffix, {
    hot: {
      accept: (paths, accept) => {
        if (Array.isArray(paths)) {
          dependencies = [...paths]; callback = accept;
        }
      },
      invalidate: message => invalidations.push(message),
    },
    GameHotReload: { publish: update => updates.push(update) },
    ...context,
  });

  return {
    dependencies,
    callback,
    updates,
    invalidations,
  };
}

test("object boundaries use the canonical factory and install updated alias constructors", () => {
  const Previous = class MapAnimationActor {};
  const Next = class MapAnimationActor {};
  const classes = new Map([["Hero", Previous], ["SeatedRoyal", Previous]]);
  const { dependencies, callback, updates } = boundary(transform("objects/MapObjectFactory.js"), { OBJECT_CLASSES: classes });
  assert.ok(dependencies.includes("./castle-props/chair/Chair.js"));
  assert.ok(dependencies.includes("./enemies/bell-bug/index.js"));
  assert.ok(!dependencies.includes("./MapObjectDefinitions.js"));
  assert.ok(!dependencies.includes("./characters/hero/Hero.js"));
  callback([{ MapAnimationActor: Next }]);
  assert.equal(classes.get("Hero"), Next);
  assert.equal(classes.get("SeatedRoyal"), Next);
  assert.deepEqual([...updates[0].objects], ["Hero", "SeatedRoyal"]);
});

test("JSON boundaries replace only the changed loader", () => {
  const replaced = [];
  const { dependencies, callback, updates } = boundary(transform("MapFileLoader.js"), {
    MapFileLoader: {
      replaceDevelopmentMap: (path, map) => {
        replaced.push([path, map]);

        return "test_changed";
      },
    },
  });
  const modules = Array(dependencies.length);
  const path = "/src/game/maps/tests/bookshelf.json";
  const changed = { objects: [] };
  modules[dependencies.indexOf(path)] = { default: changed };
  callback(modules);
  assert.deepEqual(replaced, [["./maps/tests/bookshelf.json", changed]]);
  assert.deepEqual([...updates[0].maps], ["test_changed"]);
});

test("a renamed or removed object export invalidates instead of leaving stale code", () => {
  const classes = new Map([["Chair", class Chair {}]]);
  const result = boundary(transform("objects/MapObjectFactory.js"), { OBJECT_CLASSES: classes });
  result.callback([{ Renamed: class Renamed {} }]);
  assert.equal(result.invalidations.length, 1);
  assert.deepEqual(result.updates, []);
});

test("HUD boundaries update live exports while leaving shared UI infrastructure unaccepted", () => {
  const code = transform("ui/index.js");
  assert.match(code, /export let CoinHud = InitialCoinHud/);
  assert.match(code, /export \{ GamePanelHud \} from/);
  const Next = class CoinHud {};
  const { dependencies, callback, updates } = boundary(code, { CoinHud: null });
  assert.ok(!dependencies.includes("./GamePanelHud.js"));
  callback([{ CoinHud: Next }]);
  assert.equal(updates[0].huds[0], Next);
});

test("the plugin is dev-only and ignores renderer and physics modules", () => {
  const plugin = createPlugin(root);
  assert.equal(plugin.apply, "serve");
  assert.equal(plugin.transform("export class Renderer {}", game + "/PlayCanvasRenderer.js"), undefined);
  assert.equal(plugin.transform("export class World {}", game + "/physics/AmmoRuntime.js"), undefined);
});

test("only static leaf classes qualify for local visual replacement", () => {
  const plugin = createPlugin(root);
  const context = {
    parse: code => parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    }),
  };
  const simple = "export class Chair extends AbstractCastleProp { static get modelUrl() { return url; } }";
  const stateful = "export class Chair extends AbstractCastleProp { #state = connect(); static get modelUrl() { return url; } }";
  const constructor = "export class Chair extends AbstractCastleProp { constructor(options) { super(options); connect(); } }";
  const id = game + "/objects/castle-props/chair/Chair.js";
  assert.match(plugin.transform.call(context, simple, id), /developmentVisualOnly/);
  assert.equal(plugin.transform.call(context, stateful, id), undefined);
  assert.equal(plugin.transform.call(context, constructor, id), undefined);
});
