import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { Entity, EventHandler, Vec3 } from "playcanvas";
import { GameObjectAudio } from "../../../../src/game/audio/GameObjectAudio.js";
import { HeroAudio } from "../../../../src/game/objects/characters/hero/HeroAudio.js";
import { CastleAudio } from "../../../../src/game/audio/castle/CastleAudio.js";

/**
 * @returns {{root:Entity,entity:Entity,app:EventHandler,played:string[],library:{get:()=>{id:number}}}}
 */
function fixture() {
  const root = new Entity("Root");
  // A real engine entity has an inherited enabled getter, not enabledInHierarchy.
  root._enabledInHierarchy = true;
  const entity = new Entity("Hero");
  root.addChild(entity);
  const played = [];
  const app = new EventHandler();
  const slots = {};
  entity.addComponent = () => {
    entity.sound = {
      enabled: true,
      volume: 1,
      addSlot: (name, options) => {
        slots[name] = options;
      },
      slot: (name) => slots[name],
      play: (name) => played.push(name),
    };
  };

  return {
    root,
    entity,
    app,
    played,
    library: { get: () => ({ id: 1 }) },
  };
}

test("engine entities play while enabled and stop dispatching while disabled", () => {
  const f = fixture();
  const audio = new GameObjectAudio(f.entity, f.app, f.library, { step: { wavUrl: "step.wav" } });
  audio.play("step");
  f.entity.enabled = false;
  audio.play("step");
  assert.deepEqual(f.played, ["step"]);
});

test("distance fading follows the actor and releases its update listener on destruction", () => {
  const f = fixture();
  const audio = new GameObjectAudio(f.entity, f.app, f.library, { fire: { wavUrl: "fire.wav" } });
  const listener = new Vec3(6, 0, 0);
  audio.follow(() => listener, 12);
  assert.equal(f.entity.sound.volume, 0.25);
  listener.x = 15;
  f.app.fire("update");
  assert.equal(f.entity.sound.volume, 0);
  f.entity.destroy();
  assert.equal(f.app.hasEvent("update"), false);
});

test("footsteps follow real travel; teleport and tiny support gaps remain quiet", () => {
  const f = fixture();
  const audio = new HeroAudio(f.entity, f.app, f.library, { objects: [] });
  audio.update(0.016, new Vec3(), true, false);
  audio.update(0.016, new Vec3(0.6, 0, 0), true, false);
  audio.update(0.016, new Vec3(1.2, 0, 0), true, false);
  assert.deepEqual(f.played, ["grassStep2"]);
  f.played.length = 0;
  audio.update(0.016, new Vec3(20, 10, 0), false, false);
  audio.update(0.016, new Vec3(20, 10, 0), true, false);
  assert.deepEqual(f.played, []);
  audio.update(0.2, new Vec3(20, 10.3, 0), false, false);
  audio.update(0.016, new Vec3(20, 10, 0), true, false);
  assert.deepEqual(f.played, ["land"]);
});

test("swept voxel impacts are throttled while later strokes remain audible", () => {
  const f = fixture();
  const audio = new HeroAudio(f.entity, f.app, f.library, { objects: [] });
  audio.impact("axe");
  audio.impact("axe");
  audio.update(0.2, new Vec3(), true, false);
  audio.impact("axe");
  assert.deepEqual(f.played, ["axe", "axe"]);
});

test("every castle clip ships a nonempty WAV master and an Ogg Vorbis fallback pair", () => {
  for (const source of CastleAudio.sources) {
    const wav = readFileSync(new URL(source.wavUrl));
    const ogg = readFileSync(new URL(source.oggUrl));
    assert.equal(wav.subarray(0, 4).toString(), "RIFF", source.wavUrl);
    assert.equal(wav.subarray(8, 12).toString(), "WAVE", source.wavUrl);
    assert.ok(wav.length > 1024, source.wavUrl);
    assert.equal(ogg.subarray(0, 4).toString(), "OggS", source.oggUrl);
    assert.ok(ogg.includes(Buffer.from("vorbis")), source.oggUrl);
    assert.ok(ogg.length > 1024, source.oggUrl);
  }
});
