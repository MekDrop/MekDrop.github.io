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
  .replace('import { BridgeSlimeArtwork } from "./BridgeSlimeArtwork.js";', `
    class BridgeSlimeArtwork {
      static modelUrls = [];
      constructor({root}) { root.testSlimeDeck = this; }
      setSpanPoses(poses) { this.poses = poses; }
      setDonorSources(sources) { this.sources = sources; }
      addStation() {}
      setLoads() {}
      update() { this.updateSources = this.sources; }
      destroy() {}
    }
  `)
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', `
    class BridgeRailingKit {
      static modelUrls = ["rail", "post"];
      addRailing() {}
      build() { return []; }
    }
  `)
  .replace('import { BridgeArtwork } from "./BridgeArtwork.js";', `
    class BridgeArtwork {
      static modelUrls = [];
      boxes = [];
      constructor({root}) { root.testDeck = this; }
      addStation(args) { this.boxes.push(args); }
      addIslandSupport(args) { this.support = args; }
      build() { return []; }
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
      update(deltaTime) { this.lastDelta = deltaTime; }
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
  const signals = [];
  const options = {
    pc: playcanvas,
    app: {
      fragmentEvents: [],
      fire: (name, payload) => (name === "bridge:collapsing" ? signals : events).push({
        name,
        ...payload,
      }),
    },
    modelLibrary: { instantiate: (url) => new playcanvas.Entity(url) },
    runtime: {
      mapData: map,
      materials: new Map([["timber", {}]]),
      collisionWorld: {
        add: (physics) => {
          options.app.testSlimePhysics = physics;
          physics.getPlacementStatus = () => options.app.testPlacementStatus ?? "stable";
          physics.isPreparationComplete = () => options.app.testPreparationComplete ?? true;
          physics.isLoadReady = () => options.app.testLoadReady ?? !["pending", "failed"].includes(options.app.testPlacementStatus);
        },
      },
    },
  };
  const bridge = new Bridge({
    ...options,
    definition: target,
  });
  const bridgePhysics = options.app.testSlimePhysics;
  const otherBridge = new Bridge({
    ...options,
    definition: other,
  });

  return {
    bridge,
    bridgePhysics,
    otherBridge,
    options,
    map,
    target,
    other,
    events,
    signals,
  };
}

it("signals the whole bridge failure synchronously before releasing its first section", () => {
  const context = fixture(6, true);
  const { bridge, target, signals, map } = context;
  const first = target.span.start + 2;
  const fire = context.options.app.fire;
  context.options.app.fire = (name, payload) => {
    if (name === "bridge:collapsing") {
      assert.ok(target.span.cells.every((cell) => map.tileMeta[cell.row][cell.col].bridgeCollapsing));
      assert.ok(target.span.cells.every((cell) => !map.tileMeta[cell.row][cell.col].bridgeCollapsed));
    }
    fire(name, payload);
  };
  assert.equal(bridge.collapseStation(-1), false);
  assert.equal(signals.length, 0);
  assert.equal(bridge.collapseStation(first), true);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].map, map);
  assert.equal(signals[0].cells, target.span.cells);
  assert.equal(signals[0].elevation, target.elevation);
  assert.equal(bridge.collapseStation(first), false);
  assert.equal(signals.length, 1);
  bridge.destroy();
  context.otherBridge.destroy();
});

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
  for (const fromEnd of [true, false]) {
    it(`anchors floating brackets to the owning ${fromEnd ? "end" : "start"} bank on ${horizontal ? "X" : "Z"}`, () => {
      const context = fixture(3, horizontal, (map, target) => {
        const { span } = target;
        const bank = fromEnd ? span.end + 1 : span.start - 1;
        const across = Math.floor(span.crossCenter);
        map.islandConnectorData = {
          cells: span.cells,
          nearIsland: [...span.cells.map(({ col, row }) => `${col},${row}`),
            horizontal ? `${bank},${across}` : `${across},${bank}`],
          farIsland: [],
        };
      });
      const visual = context.bridge.entity.findByName("Intact bridge deck and railings");
      const support = visual.testDeck.support;
      assert.equal(support.direction, fromEnd ? -1 : 1);
      const bankEdge = fromEnd ? context.target.span.end + 0.5 : context.target.span.start - 0.5;
      assert.equal(horizontal ? support.position.x : support.position.z, bankEdge - 5.5);
      assert.equal(support.position.y, context.target.elevation);
      assert.ok(Math.abs(support.length - 2.34) < 0.000001);
      context.bridge.collapseStation(fromEnd ? context.target.span.end : context.target.span.start);
      assert.equal(context.bridge.entity.findByName("Intact bridge deck and railings").testDeck.support, undefined,
        "a severed bank connection must not leave an intact bracket under a missing station");
      context.bridge.destroy();
      context.otherBridge.destroy();
    });
  }
  it(`spreads floating lift failure without bank hinges (${horizontal ? "horizontal" : "vertical"})`, () => {
    const context = fixture(6, horizontal, (map, target) => {
      map.islandConnectorData = {
        cells: target.span.cells,
        nearIsland: target.span.cells.map(({ col, row }) => `${col},${row}`),
        farIsland: [],
      };
    });
    const { bridge, target, events } = context;
    const strike = target.span.start + 2;
    bridge.collapseStation(strike);
    const first = fragments(bridge.entity)[0];
    bridge.onFrame(0.1);
    assert.equal(events.length, 1, "lift takes time to fail even when no bank supports exist");
    bridge.onFrame(0.07);
    assert.equal(events.length, 3, "failure travels in both directions from the hammer strike");
    for (let frame = 0; frame < 6; frame++) {
      bridge.onFrame(0.17);
    }
    const released = fragments(bridge.entity);
    assert.equal(released.length, 6);
    assert.ok(released.every((fragment) => fragment.anchors.length === 0 && fragment.connections.length === 0));
    assert.equal(first.poseReads, 0, "floating failure never waits for a structural edge to fall");
    assert.equal(first.lastDelta, 0.17, "hover dynamics advance through the fragment's own lifecycle");
    assert.ok(metadata(context).every((meta) => meta.bridgeCollapsed && !meta.bridgeCollapsing));
    bridge.onFrame(8);
    assert.equal(fragments(bridge.entity).length, 0);
    bridge.destroy();
    context.otherBridge.destroy();
  });
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

it("restores two-lane support only after a contributor has finished spreading", () => {
  const context = fixture(1, true);
  const { bridge, map, target, events } = context;
  const station = target.span.start;
  assert.equal(bridge.rebuildDemand, null);
  bridge.collapseStation(station);
  assert.equal(bridge.rebuildDemand.count, 1);
  const slug = { position: bridge.stationPosition(station - 1) };
  const competitor = { position: slug.position.clone() };
  const claim = bridge.reserveRebuildStation(slug);
  assert.equal(claim.station, station);
  assert.equal(claim.approach.x, slug.position.x + 0.35);
  assert.equal(bridge.reserveRebuildStation(competitor), null);
  assert.equal(bridge.restoreSlimeStation(station, competitor), false);
  assert.equal(bridge.restoreSlimeStation(station, slug), true);
  assert.equal(bridge.rebuildDemand.count, 0);
  assert.equal(bridge.isIntact(station), false);
  bridge.onFrame(2.19);
  assert.equal(bridge.isIntact(station), false);
  bridge.onFrame(0.02);
  assert.equal(bridge.isIntact(station), true);
  assert.equal(bridge.rebuildDemand.count, 0);
  bridge.onFrame(0.2);
  assert.equal(bridge.rebuildDemand, null);
  assert.ok(target.span.cells.every((cell) => map.tileMeta[cell.row][cell.col].bridgeSlime));
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 1);
  assert.ok(map.riverData[0].cells.filter((cell) => target.span.cells.some((targetCell) => targetCell.col === cell.col && targetCell.row === cell.row)).every((cell) => cell.underBridge));
  bridge.destroy();
  context.otherBridge.destroy();
});

it("keeps a lower walking path open without demanding living replacement deck", () => {
  const context = fixture(1, false, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeGroundPath = true;
      map.tileMeta[cell.row][cell.col].bridgeGroundHeight = 0;
    }
  });
  context.bridge.collapseStation(context.target.span.start);
  assert.equal(context.bridge.rebuildDemand, null);
  assert.equal(context.bridge.reserveRebuildStation({ position: new playcanvas.Vec3() }), null);
  context.bridge.destroy();
  context.otherBridge.destroy();
});

it("reserves only reachable construction fronts on each worker's bank", () => {
  for (const horizontal of [true, false]) {
    const context = fixture(3, horizontal, (map, target) => {
      for (const cell of target.span.cells) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
      }
    });
    const { bridge, target } = context;
    const first = { position: bridge.stationPosition(target.span.start - 1) };
    const second = { position: first.position.clone() };
    const far = { position: bridge.stationPosition(target.span.end + 1) };
    const claim = bridge.reserveRebuildStation(first);
    assert.equal(claim.station, target.span.start);
    assert.equal(bridge.reserveRebuildStation(second), null);
    assert.equal(bridge.reserveRebuildStation(far).station, target.span.end);
    assert.equal(bridge.restoreSlimeStation(claim.station, first), true);
    assert.equal(bridge.reserveRebuildStation(second), null);
    bridge.onFrame(2.21);
    bridge.onFrame(0.2);
    const next = bridge.reserveRebuildStation(second);
    assert.equal(next.station, target.span.start + 1);
    const adjacent = bridge.stationPosition(target.span.start);
    const targetPosition = bridge.stationPosition(target.span.start + 1);
    assert.deepEqual(next.approach, adjacent.clone().lerp(adjacent, targetPosition, 0.35));
    assert.deepEqual(bridge.reserveRebuildStation(second), next);
    bridge.destroy();
    context.otherBridge.destroy();
  }
});


it("keeps admitted suspension paths during sway and withdraws them after actual disconnection", async () => {
  const controlledSource = source.replace(/import \{ BridgeSlimePhysics \} from "[^"]+BridgeSlimePhysics.js";/, `
    class BridgeSlimePhysics {
      connected = true;
      settled = true;
      constructor({ app }) { app.testSlimePhysics = this; }
      sync() {}
      update() { return new Map(); }
      getPose() { return null; }
      destroy() {}
    }
  `);
  const { Bridge: ControlledBridge } = await import(`data:text/javascript;base64,${Buffer.from(controlledSource).toString("base64")}`);
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeSlime = true;
      map.tileMeta[cell.row][cell.col].bridgeSlimeSupported = false;
    }
  });
  context.bridge.destroy();
  const bridge = new ControlledBridge({
    ...context.options,
    definition: context.target,
  });
  try {
    const physics = context.options.app.testSlimePhysics;
    bridge.onFrame(1 / 60);
    assert.ok(metadata(context).every((meta) => meta.bridgeSlimeSupported));
    const admittedPaths = context.map.paths;
    const eventCount = context.events.length;
    physics.settled = false;
    bridge.onFrame(1 / 60);
    assert.ok(metadata(context).every((meta) => meta.bridgeSlimeSupported), "load sway preserves admitted walking support");
    assert.equal(context.map.paths, admittedPaths, "load sway does not rebuild routes");
    assert.equal(context.events.length, eventCount, "load sway does not broadcast terrain collapse");
    physics.connected = false;
    bridge.onFrame(1 / 60);
    assert.ok(metadata(context).every((meta) => !meta.bridgeSlimeSupported), "lost physical bank connection revokes walking support");
    assert.notEqual(context.map.paths, admittedPaths, "actual disconnection rebuilds walking routes");
    const withdrawnPaths = context.map.paths;
    const losses = context.events.filter((event) => event.name === "bridge:collapsed");
    assert.equal(losses.length, 1);
    assert.equal(losses[0].map, context.map);
    assert.deepEqual(losses[0].cells, context.target.span.cells);
    bridge.onFrame(1 / 60);
    assert.equal(context.map.paths, withdrawnPaths, "continued disconnection does not repeat route rebuilds");
    assert.equal(context.events.filter((event) => event.name === "bridge:collapsed").length, 1);
  } finally {
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("retains a donating worker until physical placement succeeds and adapts failed retries", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, target, options, map, events } = context;
  const water = map.riverData[0].cells.filter((cell) => target.span.cells.some((targetCell) => targetCell.col === cell.col && targetCell.row === cell.row));
  for (const cell of water) {
    cell.underBridge = false;
  }
  const station = target.span.start;
  const donor = { position: bridge.stationPosition(station - 1) };
  const nextWorker = { position: donor.position.clone() };
  const initial = bridge.reserveRebuildStation(donor);
  assert.equal(initial.attempt, 1);
  assert.equal(bridge.restoreSlimeStation(station, donor), true);
  options.app.testPlacementStatus = "pending";
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "growing");
  assert.equal(bridge.reserveRebuildStation(nextWorker), null);
  assert.equal(bridge.rebuildDemand.count, 2);
  assert.ok(water.every((cell) => !cell.underBridge));
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 0);
  options.app.testPlacementStatus = "failed";
  bridge.onFrame(0.1);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "failed");
  assert.equal(bridge.isIntact(station), false);
  assert.equal(bridge.rebuildDemand.count, 3);
  assert.ok(water.every((cell) => !cell.underBridge));
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 0);
  assert.equal(bridge.failRebuildAttempt(station, donor), false);
  assert.match(bridge.testStatus, /1 failed placements/);
  const retry = bridge.reserveRebuildStation(donor);
  assert.equal(retry.attempt, 2);
  assert.ok(retry.settleSeconds > initial.settleSeconds);
  assert.equal(bridge.restoreSlimeStation(station, donor), true);
  options.app.testPlacementStatus = "stable";
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "complete");
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 1);
  assert.ok(water.filter((cell) => cell.col === station).every((cell) => cell.underBridge));
  assert.equal(bridge.failRebuildAttempt(station, donor), false);
  assert.equal(bridge.reserveRebuildStation(nextWorker).station, station + 1);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("rolls back an interrupted donation before geometry or river topology can be admitted", () => {
  const context = fixture(1, true);
  const { bridge, target, map, events } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  const donor = { position: bridge.stationPosition(station - 1) };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  bridge.onFrame(0.5);
  assert.equal(bridge.failRebuildAttempt(station, donor), true);
  bridge.onFrame(5);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "failed");
  assert.equal(bridge.isIntact(station), false);
  assert.equal(bridge.rebuildDemand.count, 1);
  assert.ok(map.riverData[0].cells.filter((cell) => cell.col === station && cell.row < 8).every((cell) => !cell.underBridge));
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 0);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("counts a new failed reservation by the same donor after its previous failed attempt", () => {
  const context = fixture(1, true);
  const { bridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  const donor = { position: bridge.stationPosition(station - 1) };
  assert.equal(bridge.reserveRebuildStation(donor).attempt, 1);
  assert.equal(bridge.failRebuildAttempt(station, donor), true);
  assert.equal(bridge.failRebuildAttempt(station, donor), false);
  const retry = bridge.reserveRebuildStation(donor);
  assert.equal(retry.attempt, 2);
  assert.equal(bridge.failRebuildAttempt(station, donor), true);
  assert.equal(bridge.failRebuildAttempt(station, donor), false);
  const next = bridge.reserveRebuildStation(donor);
  assert.equal(next.attempt, 3);
  assert.ok(next.settleSeconds > retry.settleSeconds);
  assert.match(bridge.testStatus, /2 failed placements/);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("keeps a bound retry exclusive until its worker resumes or releases", () => {
  const context = fixture(1, true);
  const { bridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  const donor = { position: bridge.stationPosition(station - 1) };
  const competitor = { position: donor.position.clone() };
  bridge.reserveRebuildStation(donor);
  assert.equal(bridge.failRebuildAttempt(station, donor, true), true);
  assert.equal(bridge.reserveRebuildStation(competitor), null);
  assert.equal(bridge.failRebuildAttempt(station, donor, true), false);
  const retry = bridge.reserveRebuildStation(donor);
  assert.equal(retry.attempt, 2);
  assert.equal(bridge.failRebuildAttempt(station, donor, true), true);
  assert.equal(bridge.reserveRebuildStation(competitor), null);
  bridge.releaseRebuildStation(donor);
  assert.equal(bridge.reserveRebuildStation(competitor).attempt, 3);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("keeps the claimed bank direction and rejects a folded predecessor's backward joint exit", () => {
  for (const horizontal of [true, false]) {
    const context = fixture(3, horizontal, (map, target) => {
      for (const cell of target.span.cells) {
        const along = horizontal ? cell.col : cell.row;
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = along === target.span.end;
        map.tileMeta[cell.row][cell.col].bridgeSlime = along < target.span.end;
      }
    });
    const { bridge, bridgePhysics, target } = context;
    const adjacent = target.span.end - 1;
    const center = bridge.stationPosition(adjacent);
    const forward = new playcanvas.Vec3(horizontal ? 0.5 : 0, 0, horizontal ? 0 : 0.5);
    const pose = {
      position: center,
      start: center.clone().add(forward),
      end: center.clone().sub(forward),
    };
    bridgePhysics.getPose = (station) => station === adjacent ? pose : null;
    bridgePhysics.getEntity = () => null;
    const donor = { position: bridge.stationPosition(target.span.start - 1) };
    assert.equal(bridge.reserveRebuildStation(donor), null);
    pose.start = center.clone().sub(forward);
    pose.end = center.clone().add(forward);
    const claim = bridge.reserveRebuildStation(donor);
    assert.equal(claim.station, target.span.end);
    assert.equal(claim.direction, -1);
    assert.deepEqual(claim.placementEdge, pose.end);
    assert.deepEqual(claim.supports[0].entry, pose.start);
    assert.deepEqual(claim.supports[0].exit, pose.end);
    donor.position = bridge.stationPosition(target.span.end + 1);
    const movingClaim = bridge.reserveRebuildStation(donor);
    assert.equal(movingClaim.direction, -1);
    assert.deepEqual(movingClaim.placementEdge, pose.end);
    bridge.failRebuildAttempt(target.span.end, donor, true);
    const retry = bridge.reserveRebuildStation(donor);
    assert.equal(retry.direction, -1);
    assert.equal(retry.attempt, 2);
    assert.deepEqual(retry.position, claim.position);
    assert.ok(retry.approach.distance(center) < claim.approach.distance(center));
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("preserves direction and exclusivity from native failure through the donor's bound retry callback", () => {
  for (const status of ["failed", "pending"]) {
    const context = fixture(3, true, (map, target) => {
      for (const cell of target.span.cells) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = cell.col === target.span.end;
      }
    });
    const { bridge, target, options } = context;
    const station = target.span.end;
    const donor = { position: bridge.stationPosition(target.span.start - 1) };
    const competitor = { position: bridge.stationPosition(station + 1) };
    assert.equal(bridge.reserveRebuildStation(donor).direction, -1);
    assert.equal(bridge.restoreSlimeStation(station, donor), true);
    options.app.testPlacementStatus = status;
    bridge.onFrame(2.3);
    bridge.onFrame(0.2);
    if (status === "pending") {
      bridge.onFrame(12);
    }
    assert.equal(bridge.getRebuildAttemptStatus(station, donor), "failed");
    assert.equal(bridge.reserveRebuildStation(competitor), null);
    // Mirrors LatchBridgeState.#failAndRetry after its status poll. The already
    // failed attempt is not counted twice and its retained lease stays intact.
    assert.equal(bridge.failRebuildAttempt(station, donor, true), false);
    assert.equal(bridge.reserveRebuildStation(competitor), null);
    donor.position = competitor.position.clone();
    const retry = bridge.reserveRebuildStation(donor);
    assert.equal(retry.direction, -1);
    assert.equal(retry.attempt, 2);
    assert.match(bridge.testStatus, /1 failed placements/);
    bridge.releaseRebuildStation(donor);
    assert.equal(bridge.reserveRebuildStation(competitor).direction, 1);
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("revokes a committed failed section and its dependent frontier while retaining local donor identities", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target, map } = context;
  const first = target.span.start;
  const position = bridge.stationPosition(first - 1);
  const firstDonor = { position: position.clone() };
  const secondDonor = { position: position.clone() };
  let canceled = 0;
  const thirdDonor = {
    position: position.clone(),
    cancelBridgeApproach: (owner, station, bankTarget) => {
      assert.equal(owner, bridge);
      assert.equal(station, first + 2);
      assert.deepEqual(bankTarget, bridge.stationPosition(first - 1));
      assert.equal(bridge.isIntact(first + 1), true);
      canceled++;
    },
  };
  bridge.reserveRebuildStation(firstDonor);
  bridge.restoreSlimeStation(first, firstDonor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(first, firstDonor), "complete");
  bridge.reserveRebuildStation(secondDonor);
  bridge.restoreSlimeStation(first + 1, secondDonor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, secondDonor), "complete");
  assert.equal(bridge.reserveRebuildStation(thirdDonor).station, first + 2);
  const localFailure = new playcanvas.Vec3(-2.7, 1.1, 0);
  const actualVelocity = new playcanvas.Vec3(0.4, -1.2, 0.2);
  bridgePhysics.getPose = (station) => station === first + 1 ? { position: localFailure } : null;
  bridgePhysics.getEntity = () => ({ rigidbody: { linearVelocity: actualVelocity } });
  bridgePhysics.getFailedStations = () => [first + 1];
  bridge.onFrame(0.1);
  assert.equal(canceled, 1);
  assert.deepEqual(thirdDonor.position, position);
  assert.equal(bridge.getRebuildAttemptStatus(first, firstDonor), "complete");
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, secondDonor), "failed");
  assert.equal(bridge.getRebuildAttemptStatus(first + 2, thirdDonor), "failed");
  assert.deepEqual(bridge.getRebuildRecovery(first + 1, secondDonor).position, localFailure);
  assert.deepEqual(bridge.getRebuildRecovery(first + 1, secondDonor).bankTarget, bridge.stationPosition(first - 1));
  assert.deepEqual(bridge.getRebuildRecovery(first + 1, secondDonor).velocity, actualVelocity);
  actualVelocity.set(0, 0, 0);
  assert.equal(bridge.getRebuildRecovery(first + 1, secondDonor).velocity.y, -1.2);
  assert.equal(bridge.getRebuildRecovery(first + 1, firstDonor), null);
  assert.equal(bridge.isIntact(first), true);
  assert.equal(bridge.isIntact(first + 1), false);
  assert.equal(bridge.isIntact(first + 2), false);
  assert.equal(bridge.reserveRebuildStation(thirdDonor), null);
  assert.equal(bridge.rebuildDemand.count, 2);
  assert.ok(map.riverData[0].cells.filter((cell) => cell.col === first + 1 && cell.row < 8).every((cell) => !cell.underBridge));
  bridgePhysics.getFailedStations = () => [];
  bridgePhysics.getPose = () => null;
  const retry = bridge.reserveRebuildStation(secondDonor);
  assert.equal(retry.station, first + 1);
  assert.equal(retry.attempt, 2);
  assert.equal(retry.direction, -1);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("releases a retained contributor locally with native momentum before bridge disposal removes its material", () => {
  const context = fixture(1, true);
  const { bridge, bridgePhysics, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let released = null;
  let removed = false;
  const donor = {
    position: bridge.stationPosition(station - 1),
    ownsBridgeContribution: (owner, ownedStation) => owner === bridge && ownedStation === station,
    releaseBridgeContribution: (position, velocity, owningBridge, ownedStation) => {
      assert.equal(removed, false);
      assert.equal(owningBridge, bridge);
      assert.equal(ownedStation, station);
      released = { position, velocity };
      // State cleanup may request rollback; disposal must not rebuild itself.
      assert.equal(bridge.failRebuildAttempt(station, donor), false);
    },
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  const local = new playcanvas.Vec3(-1.2, 0.7, 1);
  const momentum = new playcanvas.Vec3(0.6, -0.8, 0.1);
  bridgePhysics.getPose = () => ({ position: local });
  bridgePhysics.getEntity = () => ({ rigidbody: { linearVelocity: momentum } });
  const remove = bridgePhysics.destroy.bind(bridgePhysics);
  bridgePhysics.destroy = () => {
    removed = true;
    remove();
  };
  bridge.destroy();
  assert.equal(removed, true);
  assert.deepEqual(released.position, local);
  assert.deepEqual(released.velocity, momentum);
  context.otherBridge.destroy();
});

it("does not reclaim a stale failed donor after it has moved to another bridge", () => {
  const context = fixture(1, true);
  const { bridge, otherBridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let currentBridge = bridge;
  let releases = 0;
  const donor = {
    position: bridge.stationPosition(station - 1),
    ownsBridgeContribution: (owner, ownedStation) => owner === currentBridge && ownedStation === station,
    releaseBridgeContribution: () => releases++,
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  bridge.failRebuildAttempt(station, donor);
  currentBridge = otherBridge;
  bridge.destroy();
  assert.equal(releases, 0);
  context.otherBridge.destroy();
});

it("disassociates failed attempt ownership when its recovered worker releases the bridge", () => {
  const context = fixture(1, true);
  const { bridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let checks = 0;
  const donor = {
    position: bridge.stationPosition(station - 1),
    ownsBridgeContribution: () => {
      checks++;
      return false;
    },
  };
  bridge.reserveRebuildStation(donor);
  bridge.failRebuildAttempt(station, donor, true);
  bridge.releaseRebuildStation(donor);
  bridge.destroy();
  assert.equal(checks, 0);
  context.otherBridge.destroy();
});

it("rejects overhead repair claims from the lower floor but permits real low tissue contact", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = cell.col === target.span.end;
    }
  });
  const { bridge, bridgePhysics, target } = context;
  const worker = { position: bridge.stationPosition(target.span.end - 1) };
  worker.position.y = 0.5;
  assert.equal(bridge.reserveRebuildStation(worker), null);
  worker.position = bridge.stationPosition(target.span.start - 1);
  assert.equal(bridge.reserveRebuildStation(worker).station, target.span.end);
  bridge.releaseRebuildStation(worker);
  worker.position = bridge.stationPosition(target.span.end - 1);
  worker.position.y = 0.5;
  bridgePhysics.surfaceHeightAt = () => 0.5;
  assert.equal(bridge.reserveRebuildStation(worker).station, target.span.end);
  bridge.releaseRebuildStation(worker);
  worker.position.y = -0.5;
  assert.equal(bridge.reserveRebuildStation(worker), null);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("retains the original far bank as the recovery target for a moving contributor", () => {
  const context = fixture(3, false, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target } = context;
  const station = target.span.end;
  const bank = bridge.stationPosition(station + 1);
  const donor = { position: bank.clone() };
  assert.equal(bridge.reserveRebuildStation(donor).direction, 1);
  bridge.restoreSlimeStation(station, donor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  donor.position = bridge.stationPosition(target.span.start - 1);
  bridgePhysics.getPose = () => ({ position: donor.position.clone() });
  bridgePhysics.getEntity = () => null;
  bridgePhysics.getFailedStations = () => [station];
  bridge.onFrame(0.1);
  const recovery = bridge.getRebuildRecovery(station, donor);
  assert.deepEqual(recovery.bankTarget, bank);
  recovery.bankTarget.set(99, 99, 99);
  assert.deepEqual(bridge.getRebuildRecovery(station, donor).bankTarget, bank);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("forecasts the next worker load before predecessor validation and unlocks the next worker immediately on success", () => {
  for (const direction of [-1, 1]) {
    const context = fixture(3, true, (map, target) => {
      for (const cell of target.span.cells) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
      }
    });
    const { bridge, bridgePhysics, target, options } = context;
    const station = direction < 0 ? target.span.start : target.span.end;
    const first = { position: bridge.stationPosition(station + direction) };
    const second = { position: first.position.clone() };
    let forecast = new Map();
    const sync = bridgePhysics.sync.bind(bridgePhysics);
    bridgePhysics.sync = (...args) => {
      forecast = new Map(args[4]);
      return sync(...args);
    };
    bridge.reserveRebuildStation(first);
    bridge.restoreSlimeStation(station, first);
    options.app.testPlacementStatus = "pending";
    bridge.onFrame(2.3);
    bridge.onFrame(0.2);
    assert.equal(forecast.get(station), -direction);
    assert.equal(bridge.getRebuildAttemptStatus(station, first), "growing");
    assert.equal(bridge.reserveRebuildStation(second), null);
    options.app.testPlacementStatus = "stable";
    bridge.onFrame(0.001);
    assert.equal(bridge.reserveRebuildStation(second), null);
    bridge.onFrame(0.2);
    const immediate = bridge.reserveRebuildStation(second);
    assert.equal(immediate.station, station - direction);
    assert.equal(immediate.attempt, 1);
    bridge.restoreSlimeStation(immediate.station, second);
    assert.equal(forecast.get(station), -direction);
    bridge.onFrame(2.3);
    assert.equal(forecast.has(station), false);
    assert.equal(forecast.get(immediate.station), -direction);
    const third = { position: first.position.clone() };
    assert.equal(bridge.reserveRebuildStation(third), null);
    bridge.onFrame(0.2);
    const final = bridge.reserveRebuildStation(third);
    assert.equal(final.station, station - direction * 2);
    bridge.restoreSlimeStation(final.station, third);
    assert.equal(forecast.get(immediate.station), -direction);
    bridge.onFrame(2.3);
    assert.equal(forecast.size, 0);
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("stages one next contributor safely on each bank while its predecessor forms", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, target } = context;
  const station = target.span.start;
  const bank = bridge.stationPosition(station - 1);
  const first = { position: bank.clone() };
  const second = { position: bank.clone() };
  const third = { position: bank.clone() };
  const opposite = { position: bridge.stationPosition(target.span.end + 1) };
  bridge.reserveRebuildStation(first);
  bridge.restoreSlimeStation(station, first);
  assert.equal(bridge.reserveRebuildStation(second), null);
  const stage = bridge.reserveRebuildStaging(second);
  assert.equal(stage.staging, true);
  assert.ok(stage.approach.x < bank.x);
  assert.equal(stage.approach.y, bank.y);
  assert.equal(bridge.reserveRebuildStaging(third), null);
  assert.equal(bridge.reserveRebuildStaging(opposite).direction, 1);
  assert.equal(bridge.getRebuildAttemptStatus(stage.station, second), "failed");
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.reserveRebuildStation(second).station, station + 1);
  assert.ok(bridge.reserveRebuildStaging(third));
  bridge.releaseRebuildStation(third);
  assert.ok(bridge.reserveRebuildStaging(first));
  bridge.releaseRebuildStation(first);
  first.position.y = 0.5;
  assert.equal(bridge.reserveRebuildStaging(first), null);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("promotes the staged bank worker before a fresh claimant at the newly ready frontier", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, target } = context;
  const station = target.span.start;
  const bank = bridge.stationPosition(station - 1);
  const first = { position: bank.clone() };
  const staged = { position: bank.clone() };
  const fresh = { position: bank.clone() };
  bridge.reserveRebuildStation(first);
  bridge.restoreSlimeStation(station, first);
  assert.ok(bridge.reserveRebuildStaging(staged));
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.reserveRebuildStation(fresh), null);
  assert.equal(bridge.reserveRebuildStation(staged).station, station + 1);
  assert.ok(bridge.reserveRebuildStaging(fresh));
  bridge.releaseRebuildStation(fresh);
  bridge.releaseRebuildStation(staged);
  assert.equal(bridge.reserveRebuildStation(fresh).station, station + 1);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("hands physical ownership to candidate material before validation and snapshots native timeout recovery", () => {
  const context = fixture(1, true);
  const { bridge, bridgePhysics, target, options } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let sourceActive = true;
  let materialExists = false;
  const donor = {
    position: bridge.stationPosition(station - 1),
    beginBridgeMaterialValidation: (owner, ownedStation) => {
      assert.equal(owner, bridge);
      assert.equal(ownedStation, station);
      assert.equal(materialExists, false);
      sourceActive = false;
      return true;
    },
  };
  const sync = bridgePhysics.sync.bind(bridgePhysics);
  bridgePhysics.sync = (...args) => {
    materialExists = args[0].has(station);
    assert.equal(sourceActive && materialExists, false);
    return sync(...args);
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  assert.equal(sourceActive, true);
  assert.equal(materialExists, false);
  options.app.testPlacementStatus = "pending";
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(sourceActive, false);
  assert.equal(materialExists, true);
  const nativePosition = new playcanvas.Vec3(-0.5, 1.2, 0);
  const nativeVelocity = new playcanvas.Vec3(0.2, -0.3, 0.1);
  bridgePhysics.getPose = () => ({ position: nativePosition });
  bridgePhysics.getEntity = () => ({ rigidbody: { linearVelocity: nativeVelocity } });
  bridge.onFrame(12);
  assert.equal(materialExists, false);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "failed");
  const recovery = bridge.getRebuildRecovery(station, donor);
  assert.deepEqual(recovery.position, nativePosition);
  assert.deepEqual(recovery.velocity, nativeVelocity);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("does not create candidate mass when the original identity rejects its handoff", () => {
  const context = fixture(1, true);
  const { bridge, bridgePhysics, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let admitted = false;
  const donor = {
    position: bridge.stationPosition(station - 1),
    beginBridgeMaterialValidation: () => false,
  };
  const sync = bridgePhysics.sync.bind(bridgePhysics);
  bridgePhysics.sync = (...args) => {
    admitted ||= args[0].has(station);
    return sync(...args);
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(admitted, false);
  assert.equal(bridge.getRebuildAttemptStatus(station, donor), "failed");
  assert.deepEqual(bridge.getRebuildRecovery(station, donor).position, donor.position);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("shares one volume clock and withholds full visual transfer until the native handoff", () => {
  const context = fixture(1, true);
  const { bridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  let handoff = null;
  const donor = {
    position: bridge.stationPosition(station - 1),
    beginBridgeMaterialValidation: () => {
      handoff = bridge.getRebuildMorphProgress(station, donor);
      return true;
    },
  };
  const stranger = { position: donor.position.clone() };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  assert.deepEqual(bridge.getRebuildMorphProgress(station, donor), { progress: 0, nativeAdmitted: false });
  bridge.onFrame(0.55);
  assert.equal(bridge.getRebuildMorphProgress(station, donor).progress, 0.15625);
  bridge.onFrame(0.55);
  assert.deepEqual(bridge.getRebuildMorphProgress(station, donor), { progress: 0.5, nativeAdmitted: false });
  assert.deepEqual(bridge.getRebuildMorphProgress(station, stranger), { progress: 0, nativeAdmitted: false });
  bridge.onFrame(1.1);
  assert.ok(handoff.progress < 1);
  assert.equal(handoff.nativeAdmitted, false);
  assert.deepEqual(bridge.getRebuildMorphProgress(station, donor), { progress: 1, nativeAdmitted: true });
  bridge.destroy();
  context.otherBridge.destroy();
});

it("requires observed sustained stability, preserving a bound lease through temporary predecessor motion", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, target, options, events } = context;
  const station = target.span.start;
  const first = { position: bridge.stationPosition(station - 1) };
  const second = { position: first.position.clone() };
  const third = { position: first.position.clone() };
  bridge.reserveRebuildStation(first);
  bridge.restoreSlimeStation(station, first);
  bridge.onFrame(2.3);
  assert.equal(bridge.getRebuildAttemptStatus(station, first), "growing");
  assert.equal(events.filter((event) => event.name === "bridge:restored").length, 0);
  bridge.onFrame(0.1);
  options.app.testPlacementStatus = "pending";
  bridge.onFrame(0.1);
  options.app.testPlacementStatus = "stable";
  bridge.onFrame(0.11);
  assert.equal(bridge.getRebuildAttemptStatus(station, first), "growing");
  bridge.onFrame(0.1);
  assert.equal(bridge.getRebuildAttemptStatus(station, first), "complete");
  const claim = bridge.reserveRebuildStation(second);
  assert.equal(claim.station, station + 1);
  options.app.testPlacementStatus = "pending";
  assert.equal(bridge.reserveRebuildStation(second), null);
  assert.equal(bridge.reserveRebuildStation(third), null);
  options.app.testPlacementStatus = "stable";
  assert.equal(bridge.reserveRebuildStation(second).station, claim.station);
  bridge.restoreSlimeStation(claim.station, second);
  options.app.testPlacementStatus = "pending";
  bridge.onFrame(2.3);
  assert.equal(bridge.isIntact(claim.station), false);
  assert.equal(bridge.getRebuildMorphProgress(claim.station, second).nativeAdmitted, false);
  options.app.testPlacementStatus = "stable";
  bridge.onFrame(0.01);
  assert.equal(bridge.isIntact(claim.station), true);
  assert.equal(bridge.getRebuildAttemptStatus(claim.station, second), "growing");
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(claim.station, second), "complete");
  bridge.destroy();
  context.otherBridge.destroy();
});

it("keeps the next worker staged until actual redistribution finishes, including a final handoff recheck", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = cell.col === target.span.end;
    }
  });
  const { bridge, bridgePhysics, target, options } = context;
  const station = target.span.end;
  const center = bridge.stationPosition(station - 1);
  const forward = new playcanvas.Vec3(0.5, 0, 0);
  bridgePhysics.getPose = (index) => index === station - 1 ? {
    position: center,
    start: center.clone().sub(forward),
    end: center.clone().add(forward),
  } : null;
  bridgePhysics.getEntity = () => null;
  let handoffs = 0;
  const worker = {
    position: bridge.stationPosition(target.span.start - 1),
    beginBridgeMaterialValidation: () => {
      handoffs++;
      return true;
    },
  };
  options.app.testPreparationComplete = false;
  assert.equal(bridge.reserveRebuildStation(worker), null);
  assert.equal(bridge.reserveRebuildStaging(worker).staging, true);
  // Stability alone does not authorize binding while the mass is moving.
  bridge.onFrame(0.2);
  assert.equal(bridge.reserveRebuildStation(worker), null);
  options.app.testPreparationComplete = true;
  assert.equal(bridge.reserveRebuildStation(worker).station, station);
  bridge.restoreSlimeStation(station, worker);
  options.app.testPreparationComplete = false;
  bridge.onFrame(2.3);
  assert.equal(handoffs, 0);
  assert.equal(bridge.getRebuildMorphProgress(station, worker).nativeAdmitted, false);
  options.app.testPreparationComplete = true;
  bridge.onFrame(0.01);
  assert.equal(handoffs, 1);
  assert.equal(bridge.getRebuildMorphProgress(station, worker).nativeAdmitted, true);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("allows only an existing physically bound owner to traverse safe pending motion while admission stays strict", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target, options } = context;
  const station = target.span.start;
  const first = { position: bridge.stationPosition(station - 1) };
  let bound = false;
  const second = {
    position: first.position.clone(),
    isBridgeBoundTo: (owner, ownedStation) => bound && owner === bridge && ownedStation === station + 1,
  };
  const other = { position: first.position.clone() };
  bridge.reserveRebuildStation(first);
  bridge.restoreSlimeStation(station, first);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  assert.equal(bridge.reserveRebuildStation(second).station, station + 1);
  options.app.testPlacementStatus = "pending";
  bridgePhysics.isTraversalSafe = () => true;
  assert.equal(bridge.reserveRebuildStation(second), null);
  bound = true;
  assert.equal(bridge.reserveRebuildStation(second).station, station + 1);
  assert.equal(bridge.reserveRebuildStation(other), null);
  bridge.restoreSlimeStation(station + 1, second);
  bridge.onFrame(2.3);
  assert.equal(bridge.getRebuildMorphProgress(station + 1, second).nativeAdmitted, true);
  assert.equal(bridge.getRebuildAttemptStatus(station + 1, second), "growing");
  options.app.testPlacementStatus = "stable";
  bridge.onFrame(0.01);
  bridge.onFrame(0.2);
  const thirdStation = station + 2;
  const third = {
    position: first.position.clone(),
    isBridgeBoundTo: (owner, ownedStation) => owner === bridge && ownedStation === thirdStation,
  };
  assert.equal(bridge.reserveRebuildStation(third).station, thirdStation);
  options.app.testPlacementStatus = "failed";
  bridgePhysics.isTraversalSafe = () => false;
  assert.equal(bridge.reserveRebuildStation(third), null);
  options.app.testPlacementStatus = "pending";
  assert.equal(bridge.reserveRebuildStation(third), null);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("sends artwork only current native poses after structural rollback replaces the artwork", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target } = context;
  const first = target.span.start;
  const donor = { position: bridge.stationPosition(first - 1) };
  const next = { position: donor.position.clone() };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(first, donor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  bridge.reserveRebuildStation(next);
  bridge.restoreSlimeStation(first + 1, next);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  let live = new Set([first, first + 1]);
  const oldSurvivor = { position: bridge.stationPosition(first), thickness: 1 };
  const removed = { position: bridge.stationPosition(first + 1), thickness: 1 };
  const newSurvivor = { position: bridge.stationPosition(first), thickness: 2 };
  bridgePhysics.update = () => new Map([[first, oldSurvivor], [first + 1, removed]]);
  bridgePhysics.getPose = (station) => live.has(station) ? station === first ? newSurvivor : removed : null;
  bridgePhysics.getEntity = () => null;
  bridgePhysics.getFailedStations = () => [first + 1];
  const sync = bridgePhysics.sync.bind(bridgePhysics);
  bridgePhysics.sync = (...args) => {
    live = new Set(args[0].keys());
    return sync(...args);
  };
  bridge.onFrame(0.01);
  const artwork = bridge.entity.children.find((child) => child.testSlimeDeck)?.testSlimeDeck;
  assert.ok(artwork);
  assert.equal(artwork.poses.has(first + 1), false);
  assert.equal(artwork.poses.get(first), newSurvivor);
  assert.equal(artwork.poses.get(first).thickness, 2);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("passes actual bank and free-front orientation to physics for either axis and either bank", () => {
  for (const horizontal of [true, false]) {
    for (const direction of [-1, 1]) {
      const context = fixture(3, horizontal, (map, target) => {
        const missing = direction < 0 ? target.span.end : target.span.start;
        for (const cell of target.span.cells) {
          const station = horizontal ? cell.col : cell.row;
          map.tileMeta[cell.row][cell.col].bridgeCollapsed = station === missing;
          map.tileMeta[cell.row][cell.col].bridgeSlime = station !== missing;
        }
      });
      const { bridge, bridgePhysics, target, map } = context;
      const missing = direction < 0 ? target.span.end : target.span.start;
      const bankStation = direction < 0 ? target.span.start - 1 : target.span.end + 1;
      const front = missing + direction;
      let captured;
      const sync = bridgePhysics.sync.bind(bridgePhysics);
      bridgePhysics.sync = (...args) => {
        captured = args;
        return sync(...args);
      };
      const donor = { position: bridge.stationPosition(bankStation) };
      assert.equal(bridge.reserveRebuildStation(donor).direction, direction);
      bridge.restoreSlimeStation(missing, donor);
      const [stations, supported, connected, , forecast] = captured;
      assert.equal(stations.size, 2);
      assert.equal(connected, false);
      assert.deepEqual([...forecast], [[front, -direction]]);
      assert.equal(supported(bankStation), true);
      assert.equal(supported(missing), false);
      const across = Math.floor(target.span.crossCenter);
      const col = horizontal ? bankStation : across;
      const row = horizontal ? across : bankStation;
      const original = map.grid[row][col];
      map.grid[row][col] = 0;
      assert.equal(supported(bankStation), false);
      map.grid[row][col] = original;
      map.heightmap[row][col] = 0;
      assert.equal(supported(bankStation), false);
      bridge.destroy();
      context.otherBridge.destroy();
    }
  }
});

it("identifies an intact internal deck as the anchor of a partially reconstructed branch", () => {
  for (const direction of [-1, 1]) {
    const context = fixture(4, true, (map, target) => {
      const anchor = direction < 0 ? target.span.start : target.span.end;
      const missing = direction < 0 ? target.span.end : target.span.start;
      for (const cell of target.span.cells) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = cell.col === missing;
        map.tileMeta[cell.row][cell.col].bridgeSlime = cell.col !== missing && cell.col !== anchor;
      }
    });
    const { bridge, bridgePhysics, target } = context;
    const anchor = direction < 0 ? target.span.start : target.span.end;
    const missing = direction < 0 ? target.span.end : target.span.start;
    let captured;
    const sync = bridgePhysics.sync.bind(bridgePhysics);
    bridgePhysics.sync = (...args) => {
      captured = args;
      return sync(...args);
    };
    const donor = { position: bridge.stationPosition(anchor + direction) };
    bridge.reserveRebuildStation(donor);
    bridge.restoreSlimeStation(missing, donor);
    const [stations, supported, , , forecast] = captured;
    assert.equal(stations.has(anchor), false);
    assert.equal(stations.size, 2);
    assert.equal(supported(anchor), true);
    assert.equal(supported(missing), false);
    assert.deepEqual([...forecast], [[missing + direction, -direction]]);
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("publishes bank dispatch hints without preventing single-bank construction beyond the midpoint", () => {
  for (const horizontal of [true, false]) {
    const context = fixture(6, horizontal, (map, target) => {
      for (const cell of target.span.cells) {
        map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
      }
    });
    const { bridge, target, map } = context;
    const initial = bridge.rebuildDemand;
    assert.equal(initial.count, 6);
    assert.deepEqual(initial.banks.map((bank) => bank.count), [3, 3]);
    assert.deepEqual(initial.banks.map((bank) => bank.direction), [-1, 1]);
    for (const bank of initial.banks) {
      const position = bridge.stationPosition(bank.direction < 0 ? target.span.start - 1 : target.span.end + 1);
      assert.equal(bank.position.x, position.x);
      assert.equal(bank.position.y, position.z);
      assert.equal(bank.elevation, position.y);
    }
    const source = bridge.stationPosition(target.span.start - 1);
    for (let station = target.span.start; station < target.span.start + 4; station++) {
      const worker = { position: source.clone() };
      assert.equal(bridge.reserveRebuildStation(worker).station, station);
      bridge.restoreSlimeStation(station, worker);
      if (station === target.span.start) {
        assert.deepEqual(bridge.rebuildDemand.banks.map((bank) => bank.count), [2, 3]);
      }
      bridge.onFrame(2.3);
      bridge.onFrame(0.2);
    }
    assert.deepEqual(bridge.rebuildDemand.banks.map((bank) => bank.count), [0, 2]);
    const bankStation = target.span.end + 1;
    const across = Math.floor(target.span.crossCenter);
    map.grid[horizontal ? across : bankStation][horizontal ? bankStation : across] = 0;
    assert.equal(bridge.rebuildDemand.banks.length, 1);
    assert.equal(bridge.rebuildDemand.count, 2);
    bridge.destroy();
    context.otherBridge.destroy();
  }
});

it("dispatches and hands off across load-ready truss jitter while the new candidate still needs strict stabilization", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, target, options } = context;
  const first = target.span.start;
  const donor = { position: bridge.stationPosition(first - 1) };
  const worker = { position: donor.position.clone() };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(first, donor);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  options.app.testPlacementStatus = "pending";
  options.app.testLoadReady = true;
  // An unbound new worker can approach an authenticated load-ready branch;
  // ordinary truss motion must not send staging back to an earlier section.
  assert.equal(bridge.reserveRebuildStaging(worker).station, first + 1);
  assert.equal(bridge.reserveRebuildStation(worker).station, first + 1);
  bridge.restoreSlimeStation(first + 1, worker);
  bridge.onFrame(2.3);
  assert.equal(bridge.getRebuildMorphProgress(first + 1, worker).nativeAdmitted, true);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, worker), "growing");
  bridge.onFrame(0.3);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, worker), "growing");
  options.app.testPlacementStatus = "stable";
  bridge.onFrame(0.2);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, worker), "complete");
  options.app.testPlacementStatus = "pending";
  options.app.testLoadReady = false;
  const last = { position: donor.position.clone() };
  assert.equal(bridge.reserveRebuildStation(last), null);
  last.position.y = 0.5;
  options.app.testLoadReady = true;
  assert.equal(bridge.reserveRebuildStation(last), null);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("requires physical load readiness for restored living metadata even without a current donor attempt", () => {
  const context = fixture(3, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = cell.col === target.span.end;
      map.tileMeta[cell.row][cell.col].bridgeSlime = cell.col !== target.span.end;
    }
  });
  const { bridge, target, options } = context;
  const worker = { position: bridge.stationPosition(target.span.start - 1) };
  options.app.testLoadReady = false;
  assert.equal(bridge.reserveRebuildStation(worker), null);
  options.app.testLoadReady = true;
  assert.equal(bridge.reserveRebuildStation(worker).station, target.span.end);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("transfers a genuinely bound donor under safe live load without waiting for its own load to disappear", () => {
  const context = fixture(2, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target, options } = context;
  const first = target.span.start;
  const original = { position: bridge.stationPosition(first - 1) };
  bridge.reserveRebuildStation(original);
  bridge.restoreSlimeStation(first, original);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  let bound = false;
  let handoffs = 0;
  const donor = {
    position: original.position.clone(),
    isBridgeBoundTo: (owner, station) => bound && owner === bridge && station === first + 1,
    beginBridgeMaterialValidation: () => {
      handoffs++;
      return true;
    },
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(first + 1, donor);
  options.app.testPlacementStatus = "pending";
  options.app.testLoadReady = false;
  bridgePhysics.isTraversalSafe = () => true;
  bridge.onFrame(2.3);
  assert.equal(handoffs, 0);
  assert.equal(bridge.getRebuildMorphProgress(first + 1, donor).nativeAdmitted, false);
  bound = true;
  bridge.onFrame(0.01);
  assert.equal(handoffs, 1);
  assert.equal(bridge.getRebuildMorphProgress(first + 1, donor).nativeAdmitted, true);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, donor), "growing");
  bridge.onFrame(0.3);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, donor), "growing");
  bridge.destroy();
  context.otherBridge.destroy();
});

it("bounds pre-native growth waiting and never lets an unsafe or detached grip bypass admission", () => {
  const context = fixture(2, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target, options } = context;
  const first = target.span.start;
  const original = { position: bridge.stationPosition(first - 1) };
  bridge.reserveRebuildStation(original);
  bridge.restoreSlimeStation(first, original);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  let bound = true;
  let handoffs = 0;
  const donor = {
    position: original.position.clone(),
    isBridgeBoundTo: (owner, station) => bound && owner === bridge && station === first + 1,
    beginBridgeMaterialValidation: () => handoffs++,
  };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(first + 1, donor);
  options.app.testPlacementStatus = "pending";
  options.app.testLoadReady = false;
  bridgePhysics.isTraversalSafe = () => false;
  bridge.onFrame(2.3);
  assert.equal(handoffs, 0);
  bound = false;
  bridgePhysics.isTraversalSafe = () => true;
  bridge.onFrame(12);
  assert.equal(handoffs, 0);
  assert.equal(bridge.getRebuildAttemptStatus(first + 1, donor), "failed");
  assert.equal(bridge.isIntact(first + 1), false);
  assert.equal(bridge.rebuildDemand.count, 1);
  assert.match(bridge.testStatus, /1 failed placements/);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("retains an authenticated grounded approach across temporary load-readiness loss without relaxing handoff", () => {
  const context = fixture(2, true, (map, target) => {
    for (const cell of target.span.cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
    }
  });
  const { bridge, bridgePhysics, target, options } = context;
  const station = target.span.start;
  const first = { position: bridge.stationPosition(station - 1) };
  bridge.reserveRebuildStation(first);
  bridge.restoreSlimeStation(station, first);
  bridge.onFrame(2.3);
  bridge.onFrame(0.2);
  let groundedApproach = true;
  let handoffs = 0;
  const traveler = {
    position: first.position.clone(),
    isBridgeApproachingFromGround: (owner, ownedStation) => groundedApproach && owner === bridge && ownedStation === station + 1,
    beginBridgeMaterialValidation: () => {
      handoffs++;
      return true;
    },
  };
  const outsider = { position: first.position.clone() };
  // The initial claim must still be made inside a genuine load-ready window.
  options.app.testLoadReady = false;
  assert.equal(bridge.reserveRebuildStation(traveler), null);
  options.app.testLoadReady = true;
  const claim = bridge.reserveRebuildStation(traveler);
  assert.equal(claim.station, station + 1);
  options.app.testLoadReady = false;
  options.app.testPlacementStatus = "pending";
  bridgePhysics.isTraversalSafe = () => true;
  for (let frame = 0; frame < 10; frame++) {
    assert.equal(bridge.reserveRebuildStation(traveler).station, claim.station);
    assert.equal(bridge.reserveRebuildStation(outsider), null);
  }
  groundedApproach = false;
  assert.equal(bridge.reserveRebuildStation(traveler), null);
  groundedApproach = true;
  bridgePhysics.isTraversalSafe = () => false;
  assert.equal(bridge.reserveRebuildStation(traveler), null);
  bridgePhysics.isTraversalSafe = () => true;
  assert.equal(bridge.reserveRebuildStation(traveler).station, claim.station);
  bridge.restoreSlimeStation(claim.station, traveler);
  bridge.onFrame(2.3);
  assert.equal(handoffs, 0);
  assert.equal(bridge.getRebuildMorphProgress(claim.station, traveler).nativeAdmitted, false);
  bridge.destroy();
  context.otherBridge.destroy();
});

it("feeds artwork live owned donor positions before each growth update and removes them after cancellation", () => {
  const context = fixture(1, true);
  const { bridge, target } = context;
  const station = target.span.start;
  bridge.collapseStation(station);
  const donor = { position: bridge.stationPosition(station - 1) };
  bridge.reserveRebuildStation(donor);
  bridge.restoreSlimeStation(station, donor);
  bridge.onFrame(0.1);
  const artwork = bridge.entity.children.find((child) => child.testSlimeDeck)?.testSlimeDeck;
  assert.deepEqual(artwork.sources.get(station), donor.position);
  assert.equal(artwork.updateSources, artwork.sources);
  const captured = artwork.sources.get(station);
  donor.position.x += 0.17;
  donor.position.y -= 0.08;
  assert.notDeepEqual(captured, donor.position);
  bridge.onFrame(0.1);
  assert.deepEqual(artwork.sources.get(station), donor.position);
  assert.notEqual(artwork.sources.get(station), donor.position);
  bridge.failRebuildAttempt(station, donor);
  bridge.onFrame(0.1);
  const replacement = bridge.entity.children.find((child) => child.testSlimeDeck)?.testSlimeDeck;
  assert.equal(replacement.sources.size, 0);
  bridge.destroy();
  context.otherBridge.destroy();
});
