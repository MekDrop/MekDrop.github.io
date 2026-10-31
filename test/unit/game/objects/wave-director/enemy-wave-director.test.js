import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { Enemy } from "../../../../../src/game/objects/enemies/shared/Enemy.js";
import { EnemyWaveDirector } from "../../../../../src/game/objects/wave-director/EnemyWaveDirector.js";

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
