import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { Enemy } from "../../../../../src/game/objects/enemies/shared/Enemy.js";
import { EnemyWaveDirector } from "../../../../../src/game/objects/wave-director/EnemyWaveDirector.js";
import { WalkingPaths } from "../../../../../src/game/navigation/WalkingPaths.js";

test("bridge repair demand uses its closest gate and reserves live and queued slimes", () => {
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const gates = ["far", "near"].map((id, index) => ({
    definition: {id},
    entity: new pc.Entity(id),
    arrivalCount: 0,
    entrancePath: () => ({from: new pc.Vec3(index === 0 ? 20 : 1, 0, 0)}),
  }));
  const bridge = {rebuildDemand: null};
  for (const gate of gates) {
    root.addChild(gate.entity);
  }
  const actors = [];
  const runtime = {
    objects: [...gates, bridge],
    spawnObject: (definition) => {
      const actor = {
        definition,
        alive: true,
        destroy: () => {},
      };
      actors.push(actor);

      return actor;
    },
  };
  const director = new EnemyWaveDirector({
    pc,
    app: {},
    definition: {
      id: "director",
      autoplay: false,
      waveConfig: {
        maxActive: 1,
        maxQueued: 1,
      },
    },
    runtime,
  });
  root.addChild(director.entity);
  assert.match(director.testStatus, /ai/);
  director.update(0.1);
  director.submit({
    type: "buy",
    sequence: 1,
    creature: "BellBug",
    gateId: "far",
  }, "ai");
  director.update(4);
  director.submit({
    type: "buy",
    sequence: 2,
    creature: "BellBug",
    gateId: "far",
  }, "ai");
  bridge.rebuildDemand = {
    creature: "LatchSlug",
    count: 2,
    position: new pc.Vec2(),
  };
  director.definition.autoplay = true;
  director.update(0.1);
  assert.equal(director.snapshot.queue.length, 1);
  assert.ok(director.snapshot.queue.every((order) => order.gateId === "near"));
  director.update(3);
  director.update(3);
  director.update(3);
  director.update(30);
  assert.deepEqual(actors.map((actor) => actor.definition.object), ["BellBug", "LatchSlug", "LatchSlug"]);
  assert.equal(director.snapshot.queue.length, 0);
  bridge.rebuildDemand.count = 0;
  for (const actor of actors) {
    actor.alive = false;
  }
  director.update(30);
  assert.equal(director.snapshot.queue.length, 0);
  bridge.rebuildDemand = null;
  director.definition.autoplay = false;
  director.update(1);
  assert.equal(actors.length, 4);
  assert.equal(actors[3].definition.object, "BellBug");
  assert.match(director.testStatus, /1 alive/);
  director.destroy();
  root.destroy();
});

test("only owned attackers earn terminal combat income; allies, self and forged owners do not", () => {
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const gate = {
    definition:{id:"gate"},
    entity:new pc.Entity(),
    arrivalCount:0,
    entrancePath:()=>({from:new pc.Vec3()}),
  };
  root.addChild(gate.entity);
  const runtime = {objects:[gate]};
  runtime.spawnObject = definition => {
    const enemy = new Enemy({
      pc,
      app:{},
      definition,
      runtime,
    });
    root.addChild(enemy.entity);
    runtime.objects.push(enemy);

    return enemy;
  };
  const director = new EnemyWaveDirector({
    pc,
    app:{},
    definition:{
      id:"director",
      autoplay:false,
    },
    runtime,
  });
  root.addChild(director.entity);
  director.update(.1);
  director.submit({
    type:"buy",
    sequence:1,
    creature:"LatchSlug",
    gateId:"gate",
  },"ai");
  director.update(3);
  const source = runtime.objects.find(o=>o.commander===director);
  const victim = new Enemy({
    pc,
    app:{},
    definition:{id:"victim"},
    runtime,
  });
  victim.entity.getGuid = () => "test-victim";
  victim.receiveDamage(99,source);
  assert.equal(director.snapshot.coins,4985);
  victim.receiveDamage(1,source);
  victim.receiveDamage(100,source);
  assert.equal(director.snapshot.coins,5035);
  director.submit({
    type:"buy",
    sequence:2,
    creature:"LatchSlug",
    gateId:"gate",
  },"ai");
  director.update(3);
  const ally = runtime.objects.find(o=>o!==source&&o.commander===director);
  ally.receiveDamage(100,source);
  assert.equal(director.snapshot.coins,5020);
  const forged = new Enemy({
    pc,
    app:{},
    definition:{id:"forged"},
    runtime,
  });
  forged.commander = director;
  const other = new Enemy({
    pc,
    app:{},
    definition:{id:"other"},
    runtime,
  });
  other.receiveDamage(100,forged);
  assert.equal(director.snapshot.coins,5020);
  source.receiveDamage(100,source);
  director.update(.1);
  assert.equal(director.snapshot.coins,5020);
  assert.equal(director.snapshot.active,0);
  director.destroy();
  assert.equal(director.submit({
    type:"buy",
    sequence:3,
    creature:"LatchSlug",
    gateId:"gate",
  },"ai").reason,"closed");
  root.destroy();
});

test("repair relief ignores unrelated slugs and preserves stalled workers within a bounded rescue budget", () => {
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const gate = {
    definition: { id: "gate" },
    entity: new pc.Entity(),
    arrivalCount: 0,
    entrancePath: () => ({ from: new pc.Vec3() }),
  };
  root.addChild(gate.entity);
  const bridge = { rebuildDemand: null };
  const actors = [];
  let released = 0;
  const director = new EnemyWaveDirector({
    pc,
    app: {},
    definition: {
      id: "director",
      autoplay: false,
    },
    runtime: {
      objects: [gate, bridge],
      spawnObject: (definition) => {
        const actor = {
          definition,
          alive: true,
          releaseRebuildAssignment: () => {
            released += 1;
          },
          destroy: () => {
            actor.alive = false;
          },
        };
        actors.push(actor);

        return actor;
      },
    },
  });
  root.addChild(director.entity);
  director.update(0.1);
  director.submit({
    type: "buy",
    sequence: 1,
    creature: "LatchSlug",
    gateId: "gate",
  }, "ai");
  director.update(3);
  bridge.rebuildDemand = {
    creature: "LatchSlug",
    count: 1,
    position: new pc.Vec2(),
  };
  director.definition.autoplay = true;
  director.update(3);
  assert.equal(actors.length, 2);
  for (let batch = 0; batch < 5; batch += 1) {
    director.update(181);
    director.update(0.1);
    director.update(11);
    director.update(3);
  }
  assert.equal(actors.length, 4);
  assert.equal(released, 3);
  assert.ok(actors.every((actor) => actor.alive));
  assert.equal(director.snapshot.queue.length, 0);
  director.destroy();
  root.destroy();
});

function bankRepairFixture() {
  const map = {
    cols: 30,
    rows: 9,
    grid: Array.from({ length: 9 }, () => Array(30).fill(0)),
    heightmap: Array.from({ length: 9 }, () => Array(30).fill(2)),
    tileMeta: Array.from({ length: 9 }, () => Array.from({ length: 30 }, () => ({}))),
    objects: [],
  };
  for (const row of [3, 4]) {
    for (let col = 1; col <= 28; col++) {
      if (col <= 10 || col >= 19) {
        map.grid[row][col] = 2;
      }
    }
  }
  for (const row of [6, 7]) {
    for (let col = 8; col <= 10; col++) {
      map.grid[row][col] = 2;
    }
  }
  WalkingPaths.rebuild(map);
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const gatePositions = [
    ["left", -13.5, -12.5, -0.5],
    ["right", 13.5, 12.5, -0.5],
    ["closer-disconnected", -6.5, -5.5, 2.5],
  ];
  const gates = gatePositions.map(([id, fromX, toX, z]) => ({
    definition: { id },
    entity: new pc.Entity(id),
    arrivalCount: 0,
    entrancePath: () => ({ from: new pc.Vec3(fromX, 2, z), to: new pc.Vec3(toX, 2, z) }),
  }));
  for (const gate of gates) {
    root.addChild(gate.entity);
  }
  const demand = {
    creature: "LatchSlug",
    count: 6,
    position: new pc.Vec2(0, -0.5),
    banks: [
      { direction: -1, position: new pc.Vec2(-4.5, -0.5), elevation: 2, count: 3 },
      { direction: 1, position: new pc.Vec2(4.5, -0.5), elevation: 2, count: 3 },
    ],
  };
  const bridge = { rebuildDemand: null };
  const actors = [];
  const director = new EnemyWaveDirector({
    pc,
    app: {},
    definition: { id: "director", autoplay: false },
    runtime: {
      mapData: map,
      objects: [...gates, bridge],
      spawnObject: (definition) => {
        const actor = { definition, alive: true, destroy: () => {} };
        actors.push(actor);
        return actor;
      },
    },
  });
  root.addChild(director.entity);
  return { root, map, gates, director, demand, bridge, actors };
}

test("repair splits across closest reachable gates on both real banks while normal creatures remain held", () => {
  const context = bankRepairFixture();
  const { director, bridge, demand, actors } = context;
  director.update(0.1);
  director.submit({ type: "buy", sequence: 1, creature: "BellBug", gateId: "left" }, "ai");
  bridge.rebuildDemand = demand;
  director.definition.autoplay = true;
  director.update(0.1);
  const repair = director.snapshot.queue.filter((order) => order.creature === "LatchSlug");
  assert.equal(repair.filter((order) => order.gateId === "left").length, 3);
  assert.equal(repair.filter((order) => order.gateId === "right").length, 3);
  assert.equal(repair.some((order) => order.gateId === "closer-disconnected"), false);
  for (let step = 0; step < 8; step++) {
    director.update(4);
  }
  assert.equal(actors.length, 6);
  assert.ok(actors.every((actor) => actor.definition.object === "LatchSlug"));
  assert.equal(actors.filter((actor) => actor.definition.gatewayId === "left").length, 3);
  assert.equal(actors.filter((actor) => actor.definition.gatewayId === "right").length, 3);
  demand.count = 0;
  for (const bank of demand.banks) {
    bank.count = 0;
  }
  director.update(20);
  assert.equal(actors.length, 6);
  bridge.rebuildDemand = null;
  director.definition.autoplay = false;
  director.update(4);
  assert.equal(actors.at(-1).definition.object, "BellBug");
  director.destroy();
  context.root.destroy();
});

test("unreachable opposite bank retains the original single nearest-gate attempt without a half-span cap", () => {
  const context = bankRepairFixture();
  context.gates[1].entity.enabled = false;
  context.bridge.rebuildDemand = context.demand;
  context.director.definition.autoplay = true;
  context.director.update(0.1);
  const orders = context.director.snapshot.queue.filter((order) => order.creature === "LatchSlug");
  assert.equal(orders.length, 6);
  assert.ok(orders.every((order) => order.gateId === "left"));
  context.director.destroy();
  context.root.destroy();
});

test("consumed deck and pool identities never exhaust the remaining bridge repair worker budget", () => {
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const gate = {
    definition: { id: "gate" },
    entity: new pc.Entity(),
    arrivalCount: 0,
    entrancePath: () => ({ from: new pc.Vec3() }),
  };
  root.addChild(gate.entity);
  const bridge = {
    rebuildDemand: {
      creature: "LatchSlug",
      count: 1,
      position: new pc.Vec2(),
    },
  };
  const actors = [];
  const director = new EnemyWaveDirector({
    pc,
    app: {},
    definition: {
      id: "director",
      waveConfig: {
        maxActive: 1,
        maxQueued: 1,
      },
    },
    runtime: {
      objects: [gate, bridge],
      spawnObject: (definition) => {
        const actor = {
          definition,
          alive: true,
          rebuildContributionConsumed: false,
          releaseRebuildAssignment: () => assert.fail("consumed identities cannot expire as stalled approaches"),
          destroy: () => {},
        };
        actors.push(actor);

        return actor;
      },
    },
  });
  root.addChild(director.entity);
  for (let contributor = 0; contributor < 9; contributor++) {
    director.update(3);
    director.update(3);
    assert.equal(actors.length, contributor + 1, "a new worker can still arrive after earlier workers became deck or counterweights");
    actors.at(-1).rebuildContributionConsumed = true;
  }
  assert.ok(actors.every((actor) => actor.alive));
  bridge.rebuildDemand.count = 0;
  director.update(181);
  assert.equal(actors.length, 9, "the donor chain stops producing workers when repair demand is satisfied");
  director.destroy();
  root.destroy();
});
