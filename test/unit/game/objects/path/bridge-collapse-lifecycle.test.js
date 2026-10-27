import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as playcanvas from "playcanvas";
import { MapObjectDefinitions } from "../../../../../src/game/objects/MapObjectDefinitions.js";

// Execute the production owner and WalkingPaths. Only graphics batching and the
// articulated fragment boundary are replaced. Drop measurements are controlled
// explicitly rather than advancing a timer to pretend that physics happened.
const sourceUrl = new URL("../../../../../src/game/objects/path/Bridge.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', `
    class BridgeRailingKit {
      static modelUrls = ["rail", "post"];
      addRailing() {}
      build() { return []; }
    }
  `)
  .replace('import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";', `
    class TerrainInstanceRenderer {
      boxes = [];
      constructor({root}) { root.testDeck = this; }
      addBoxMatrix(...args) { this.boxes.push(args); }
      build() {}
      destroy() { this.disposed = true; }
    }
  `)
  .replace('import { BridgeDeckFragment } from "./BridgeDeckFragment.js";', `
    class BridgeDeckFragment {
      age = 0;
      drop = 0;
      anchors = [];
      connections = [];
      supportReleases = 0;
      hasSupport = false;
      impactQueue = [];
      contactReads = 0;
      poseReads = 0;
      constructor({pc, app, station, position}) {
        this.app = app;
        this.station = station;
        this.entity = new pc.Entity('Falling bridge deck ' + station);
        this.entity.testFragment = this;
        this.entity.setPosition(position);
      }
      anchor(direction) {
        this.anchors.push(direction);
        this.hasSupport = true;
        return true;
      }
      connectTo(next, direction) {
        this.connections.push({next, direction});
        this.hasSupport = true;
        return true;
      }
      freeEdgeDrop() {
        this.poseReads++;
        return this.drop;
      }
      consumeGroundImpact() {
        this.contactReads++;
        return this.impactQueue.shift() ?? null;
      }
      releaseSupport() {
        this.supportReleases++;
        this.hasSupport = false;
        this.app.fragmentEvents.push({kind:'release', fragment:this});
      }
      destroy() {
        this.app.fragmentEvents.push({kind:'destroy', fragment:this});
        this.disposed = true;
        this.entity.destroy();
      }
    }
  `)
  .replace('import { BridgeImpactDebris } from "./BridgeImpactDebris.js";', `
    class BridgeImpactDebris {
      static prepareResources({app}) {
        app.fragmentEvents.push({kind:'resources-prepared'});
        return {
          warmShaders: camera => app.fragmentEvents.push({kind:'resources-warmed', camera}),
          release: () => app.fragmentEvents.push({kind:'resources-released'})
        };
      }
      age = 0;
      updates = [];
      expired = false;
      constructor({pc, app, impact, station}) {
        this.app = app;
        this.impact = impact;
        this.station = station;
        this.entity = new pc.Entity('Bridge impact rubble ' + station);
        this.entity.testRubble = this;
        app.fragmentEvents.push({kind:'rubble-created', fragment:this});
      }
      update(deltaTime) {
        this.age += deltaTime;
        this.updates.push(deltaTime);
      }
      destroy() {
        this.disposed = true;
        this.app.fragmentEvents.push({kind:'rubble-destroy', fragment:this});
        this.entity.destroy();
      }
    }
  `)
  .replace(/from "(\.\.?\/[^\"]+)"/g, (_match, path) => `from "${new URL(path, sourceUrl).href}"`);
const { Bridge } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

/**
 * @param {number} length
 * @param {boolean} horizontal
 * @param {number} cross
 * @param {string} id
 */
function definition(length, horizontal, cross, id) {
  const start = 3;
  const cells = [];
  for (let station = start; station < start + length; station++) {
    for (const across of [cross, cross + 1]) {
      cells.push({
        col: horizontal ? station : across,
        row: horizontal ? across : station,
      });
    }
  }

  return {
    id,
    object: "Bridge",
    elevation: 2,
    material: "timber",
    span: {
      horizontal,
      start,
      end: start + length - 1,
      center: start + (length - 1) / 2,
      length,
      crossCenter: cross + 0.5,
      cells,
    },
  };
}

/**
 * @param {number} length
 * @param {boolean} horizontal
 * @param {(map: import("../../../../../src/game/GameContracts.js").GameMapData, span: import("../../../../../src/game/objects/ObjectTypes.js").MapObjectDefinition) => void} [prepare]
 */
function fixture(length, horizontal, prepare) {
  const target = definition(length, horizontal, 3, "target-bridge");
  const other = definition(length, horizontal, 8, "other-bridge");
  const rivers = [{
    cells: [...target.span.cells, ...other.span.cells].map((cell) => ({
      ...cell,
      underBridge: true,
    })),
  }];
  const map = {
    cols: 12,
    rows: 12,
    grid: Array.from({ length: 12 }, () => Array(12).fill(1)),
    heightmap: Array.from({ length: 12 }, () => Array(12).fill(2)),
    tileMeta: Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => ({}))),
    objects: [target, other, {
      id: "test-rivers",
      object: "Rivers",
      rivers,
    }],
  };
  for (const cell of [...target.span.cells, ...other.span.cells]) {
    map.grid[cell.row][cell.col] = 2;
    map.tileMeta[cell.row][cell.col].renderMode = "BRIDGE";
  }
  MapObjectDefinitions.prepare(map);
  prepare?.(map, target);
  const events = [];
  const options = {
    pc: playcanvas,
    app: {
      fragmentEvents: [],
      fire: (name, payload) => events.push({
        name,
        ...payload,
      }),
    },
    modelLibrary: { instantiate: (url) => new playcanvas.Entity(url) },
    runtime: {
      mapData: map,
      materials: new Map([["timber", {}]]),
    },
  };
  const bridge = new Bridge({
    ...options,
    definition: target,
  });
  const otherBridge = new Bridge({
    ...options,
    definition: other,
  });

  return {
    bridge,
    otherBridge,
    options,
    map,
    target,
    other,
    events,
  };
}

/**
 * @param {ReturnType<typeof fixture>} context
 * @param {import("../../../../../src/game/objects/ObjectTypes.js").MapObjectDefinition} owner
 */
function metadata(context, owner = context.target) {
  return owner.span.cells.map(({ col, row }) => context.map.tileMeta[row][col]);
}

/**
 * @param {import("playcanvas").Entity} entity
 */
function fragments(entity) {
  return entity.children.filter((child) => child.name.startsWith("Falling bridge deck"))
    .map((child) => child.testFragment);
}

/**
 * @param {import("playcanvas").Entity} entity
 */
function rubble(entity) {
  return entity.children.filter((child) => child.name.startsWith("Bridge impact rubble"))
    .map((child) => child.testRubble);
}

/**
 * @returns {import("../../../../../src/game/objects/path/BridgeDeckFragment.js").BridgeGroundImpact}
 */
function groundImpact() {
  return {
    position: new playcanvas.Vec3(1, -2, 3),
    rotation: new playcanvas.Quat().setFromEulerAngles(15, 5, 35),
    velocity: new playcanvas.Vec3(0.2, -3, 0.1),
  };
}

for (const horizontal of [true, false]) {
  for (const length of [1, 3, 6]) {
    for (const direction of [-1, 1]) {
      it(`pulls down the ${length}-tile ${horizontal ? "horizontal" : "vertical"} bridge from direction ${direction} through measured deck movement`, () => {
        const context = fixture(length, horizontal);
        const { bridge, otherBridge, target, events, map } = context;
        const strike = direction > 0 ? target.span.start : target.span.end;
        assert.equal(bridge.collapseStation(strike), true);
        assert.equal(bridge.isIntact(strike), false);
        assert.equal(events.length, 1);
        assert.equal(events[0].cells.length, 2, "only the struck two-lane station detaches immediately");
        const first = fragments(bridge.entity)[0];
        assert.equal(fragments(bridge.entity).length, 1, "one articulated deck section replaces the struck station");
        assert.deepEqual(first.anchors, length > 1 ? [direction] : []);
        for (const cell of target.span.cells) {
          const station = horizontal ? cell.col : cell.row;
          const meta = map.tileMeta[cell.row][cell.col];
          assert.equal(Boolean(meta.bridgeCollapsed), station === strike);
          assert.equal(meta.bridgeCollapsing, station !== strike, "navigation sees the entire failed span immediately");
        }
        bridge.onFrame(0.2);
        assert.equal(events.length, 1, "elapsed time alone must not start a domino sequence");
        if (length > 1) {
          assert.equal(bridge.collapseStation(strike + direction), false, "a pending deck cannot be struck twice");
        }
        let previous = first;
        for (let step = 1; step < length; step++) {
          previous.drop = 0.24;
          bridge.onFrame(0.01);
          assert.equal(events.length, step + 1, "one measured fall releases one neighboring station");
          const next = fragments(bridge.entity).at(-1);
          assert.equal(next.station, strike + step * direction);
          assert.deepEqual(next.anchors, [direction], "the neighboring section initially retains its far support");
          assert.equal(previous.connections.length, 1);
          assert.equal(previous.connections[0].next, next, "the falling section physically loads its neighbor");
          assert.equal(previous.connections[0].direction, direction);
          previous = next;
        }
        if (length > 1) {
          bridge.onFrame(0.01);
          assert.equal(previous.hasSupport, true, "the last bank support holds until its section has tipped");
          previous.drop = 0.4;
          bridge.onFrame(0.01);
          assert.equal(previous.hasSupport, false, "a substantial measured drop breaks the remaining bank support");
        }
        assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
        assert.equal(bridge.testStatus, `0/${length} stations intact | E: hammer next station`);
        const reported = events.flatMap((event) => event.cells.map(({ col, row }) => `${col},${row}`));
        assert.equal(new Set(reported).size, length * 2);
        assert.equal(reported.length, length * 2, "each tile is removed exactly once");
        assert.ok(events.every((event) => event.name === "bridge:collapsed" && event.map === map));
        assert.equal(bridge.entity.findByName("Intact bridge deck and railings").testDeck.boxes.length, 0);
        assert.ok(metadata(context, context.other).every((meta) => !meta.bridgeCollapsed && !meta.bridgeCollapsing));
        assert.equal(otherBridge.isIntact(context.other.span.start), true);
        const water = map.riverData[0].cells;
        assert.ok(water.slice(0, length * 2).every((cell) => cell.underBridge === false));
        assert.ok(water.slice(length * 2).every((cell) => cell.underBridge === true));
        const released = fragments(bridge.entity);
        assert.equal(released.length, length, "every airborne deck section remains one coherent body");
        assert.equal(rubble(bridge.entity).length, 0, "physical tipping alone cannot replace a slab with small fragments");
        bridge.onFrame(8);
        assert.equal(fragments(bridge.entity).length, 0, "falling sections are eventually disposed");
        assert.ok(released.every((fragment) => fragment.disposed));
        const calls = context.options.app.fragmentEvents;
        const firstDestroyed = calls.findIndex((call) => call.kind === "destroy");
        assert.ok(calls.slice(firstDestroyed).every((call) => call.kind === "destroy"),
          "all constraints are removed before deleting any referenced body");
        bridge.destroy();
        otherBridge.destroy();
      });
    }
  }
}

it("opens a middle hole before the two severed bridge halves tip into it", () => {
  const context = fixture(6, true);
  const { bridge, target, events } = context;
  const strike = target.span.start + 2;
  bridge.collapseStation(strike);
  const impact = fragments(bridge.entity)[0];
  assert.deepEqual(impact.anchors, [], "the struck middle slab falls freely");
  bridge.onFrame(0.2);
  assert.equal(events.length, 1);
  impact.drop = 0.24;
  bridge.onFrame(0.01);
  assert.deepEqual(fragments(bridge.entity).slice(1).map((fragment) => fragment.station).sort(), [strike - 1, strike + 1]);
  assert.equal(impact.connections.length, 0, "the open hole does not pull both halves with one contradictory hinge");
  for (let step = 0; step < 6; step++) {
    for (const fragment of fragments(bridge.entity)) {
      fragment.drop = 0.4;
    }
    bridge.onFrame(0.01);
  }
  assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
  assert.equal(events.flatMap((event) => event.cells).length, 12);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("breaks an existing deck connection when its two sections fold apart", () => {
  const context = fixture(3, true);
  const { bridge } = context;
  bridge.collapseStation(context.target.span.start);
  const first = fragments(bridge.entity)[0];
  first.drop = 0.24;
  bridge.onFrame(0.01);
  assert.equal(first.hasSupport, true);
  first.entity.setLocalEulerAngles(0, 0, 90);
  bridge.onFrame(0.01);
  assert.equal(first.hasSupport, false, "a folded connection cannot keep stretching between rotated slabs");
  const releases = first.supportReleases;
  bridge.onFrame(0.01);
  assert.equal(first.supportReleases, releases, "a broken connection is removed from future monitoring");
  bridge.destroy();
  context.otherBridge.destroy();
});

it("releases jammed supports eventually without removing every station in one stalled frame", () => {
  const context = fixture(3, false);
  const { bridge, events } = context;
  bridge.collapseStation(context.target.span.start);
  bridge.onFrame(1);
  assert.equal(events.length, 2, "the safety release advances only one supported neighbor");
  bridge.onFrame(1);
  assert.equal(events.length, 3);
  bridge.onFrame(2);
  assert.ok(fragments(bridge.entity).every((fragment) => !fragment.hasSupport));
  assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
  bridge.destroy();
  context.otherBridge.destroy();
});

it("cancels all unreleased fronts and removes constraints before bodies on disposal", () => {
  const context = fixture(6, true);
  const { bridge, events, map, otherBridge } = context;
  bridge.collapseStation(context.target.span.start);
  const released = fragments(bridge.entity);
  bridge.destroy();
  const before = structuredClone(map.tileMeta);
  assert.ok(released.every((fragment) => fragment.disposed && !fragment.hasSupport));
  assert.equal(bridge.entity.children.length, 0);
  bridge.onFrame(10);
  assert.equal(events.length, 1, "disposed objects do not publish later topology edits");
  assert.deepEqual(map.tileMeta, before);
  assert.deepEqual(context.options.app.fragmentEvents.map((call) => call.kind), ["release", "destroy"]);
  otherBridge.destroy();
});

it("resumes a failed span as free sections after hot reload without repeating the struck station", () => {
  const context = fixture(6, false);
  context.bridge.collapseStation(context.target.span.start);
  context.bridge.destroy();
  const reloaded = new Bridge({
    ...context.options,
    definition: context.target,
  });
  assert.equal(fragments(reloaded.entity).length, 5);
  assert.ok(fragments(reloaded.entity).every((fragment) => !fragment.hasSupport && fragment.anchors.length === 0));
  assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
  const cells = context.events.flatMap((event) => event.cells.map(({ col, row }) => `${col},${row}`));
  assert.equal(cells.length, 12);
  assert.equal(new Set(cells).size, 12);
  reloaded.onFrame(0.2);
  assert.equal(context.events.length, 6, "the resumed span is not queued for a second collapse");
  reloaded.destroy();
  context.otherBridge.destroy();
});

it("does not release an old hole again or leave its unsupported marker behind", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      if (cell.col === target.span.start) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
      }
    }
  });
  context.bridge.collapseStation(context.target.span.end);
  fragments(context.bridge.entity)[0].drop = 0.24;
  context.bridge.onFrame(0.01);
  assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
  assert.equal(context.events.flatMap((event) => event.cells).length, 4, "preexisting holes are never released again");
  context.bridge.destroy();
  context.otherBridge.destroy();
});

it("keeps the coherent hinged fall until contact, then advances support before replacing the impacted slab once", () => {
  const context = fixture(6, true);
  const { bridge, target, events } = context;
  bridge.collapseStation(target.span.start);
  const first = fragments(bridge.entity)[0];
  bridge.onFrame(0.2);
  assert.equal(first.hasSupport, true);
  assert.equal(first.disposed, undefined);
  assert.equal(rubble(bridge.entity).length, 0, "hinged motion is not an impact event");
  const impact = groundImpact();
  first.impactQueue.push(impact);
  bridge.onFrame(0.01);
  const next = fragments(bridge.entity)[0];
  assert.equal(events.length, 2, "contact releases the pending neighbor even with no measured free-edge drop");
  assert.equal(next.station, target.span.start + 1);
  assert.equal(next.hasSupport, true);
  assert.equal(first.connections[0].next, next, "the next supported body exists before the old body is removed");
  assert.equal(first.disposed, true);
  assert.equal(first.hasSupport, false);
  const pieces = rubble(bridge.entity);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].impact, impact, "the rubble receives the captured contact transform and velocity");
  assert.equal(pieces[0].station, first.station);
  assert.deepEqual(pieces[0].updates, [], "new rubble starts on the following frame");
  const calls = context.options.app.fragmentEvents;
  const destruction = calls.findIndex((call) => call.kind === "destroy" && call.fragment === first);
  const replacement = calls.findIndex((call) => call.kind === "rubble-created");
  assert.ok(destruction >= 0 && replacement > destruction);
  const oldReads = [first.contactReads, first.poseReads];
  first.impactQueue.push(impact);
  bridge.onFrame(0.1);
  assert.deepEqual([first.contactReads, first.poseReads], oldReads, "old fronts and bodies are no longer sampled");
  assert.equal(events.length, 2);
  assert.equal(rubble(bridge.entity).length, 1, "the same ground hit cannot create duplicate rubble");
  assert.deepEqual(pieces[0].updates, [0.1]);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("removes links on both sides of an impacted section before deleting its body", () => {
  const context = fixture(3, false);
  const { bridge, target } = context;
  bridge.collapseStation(target.span.start);
  const first = fragments(bridge.entity)[0];
  first.drop = 0.3;
  bridge.onFrame(0.01);
  const middle = fragments(bridge.entity).at(-1);
  middle.drop = 0.3;
  bridge.onFrame(0.01);
  const last = fragments(bridge.entity).at(-1);
  assert.equal(first.connections[0].next, middle);
  assert.equal(middle.connections[0].next, last);
  middle.impactQueue.push(groundImpact());
  bridge.onFrame(0.01);
  assert.equal(first.hasSupport, false, "an incoming hinge must not retain a destroyed neighbor");
  assert.equal(middle.disposed, true);
  assert.equal(middle.hasSupport, false);
  assert.equal(last.hasSupport, true, "the unaffected bank support remains physical");
  Object.defineProperty(middle.entity, "up", {
    get: () => assert.fail("a removed deck link must not read the destroyed body"),
  });
  const reads = middle.contactReads;
  bridge.onFrame(0.01);
  assert.equal(middle.contactReads, reads);
  assert.equal(rubble(bridge.entity).length, 1);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("updates impact rubble until it expires and then stops updating its disposed resources", () => {
  const context = fixture(1, true);
  const { bridge } = context;
  bridge.collapseStation(context.target.span.start);
  fragments(bridge.entity)[0].impactQueue.push(groundImpact());
  bridge.onFrame(0.01);
  const pieces = rubble(bridge.entity)[0];
  bridge.onFrame(0.25);
  assert.deepEqual(pieces.updates, [0.25]);
  assert.equal(pieces.disposed, undefined);
  pieces.expired = true;
  bridge.onFrame(0.1);
  assert.equal(pieces.disposed, true);
  assert.equal(rubble(bridge.entity).length, 0);
  const updates = [...pieces.updates];
  bridge.onFrame(1);
  assert.deepEqual(pieces.updates, updates);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("disposes impact rubble together with remaining supported sections and cancels further impact work", () => {
  const context = fixture(3, false);
  const { bridge, events } = context;
  bridge.collapseStation(context.target.span.start);
  fragments(bridge.entity)[0].impactQueue.push(groundImpact());
  bridge.onFrame(0.01);
  const next = fragments(bridge.entity)[0];
  const pieces = rubble(bridge.entity)[0];
  next.impactQueue.push(groundImpact());
  const reads = next.contactReads;
  bridge.destroy();
  assert.equal(next.disposed, true);
  assert.equal(next.hasSupport, false);
  assert.equal(pieces.disposed, true);
  assert.equal(bridge.entity.children.length, 0);
  const before = structuredClone(context.map.tileMeta);
  bridge.onFrame(1);
  assert.equal(next.contactReads, reads);
  assert.equal(events.length, 2);
  assert.deepEqual(context.map.tileMeta, before);
  context.otherBridge.destroy();
});

it("prepares impact resources before gameplay and releases their lease after live rubble", () => {
  const context = fixture(1, true);
  const camera = { shaderParams: {} };
  context.options.runtime.camera = { camera };
  const rendered = new playcanvas.EventHandler();
  context.options.app.once = rendered.once.bind(rendered);
  const { bridge } = context;
  bridge.onSceneReady();
  bridge.onSceneReady();
  const calls = context.options.app.fragmentEvents;
  assert.equal(calls.filter((call) => call.kind === "resources-prepared").length, 1);
  assert.equal(calls.filter((call) => call.kind === "resources-warmed").length, 0);
  rendered.fire("postrender");
  assert.equal(calls.filter((call) => call.kind === "resources-warmed").length, 1);
  assert.ok(calls.filter((call) => call.kind === "resources-warmed").every((call) => call.camera === camera));
  assert.equal(rubble(bridge.entity).length, 0);
  bridge.collapseStation(context.target.span.start);
  fragments(bridge.entity)[0].impactQueue.push(groundImpact());
  bridge.onFrame(0.01);
  bridge.onSceneReady();
  bridge.destroy();
  rendered.fire("postrender");
  assert.equal(calls.filter((call) => call.kind === "resources-warmed").length, 1);
  const destroyed = calls.findIndex((call) => call.kind === "rubble-destroy");
  const released = calls.findIndex((call) => call.kind === "resources-released");
  assert.ok(destroyed >= 0 && released > destroyed);
  context.otherBridge.destroy();
});
