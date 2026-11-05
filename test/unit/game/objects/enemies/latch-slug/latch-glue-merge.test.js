import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { DoorJam } from "../../../../../../src/game/objects/architecture/door/DoorJam.js";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";

const fixture = () => {
  const jam = new DoorJam();
  const door = {
    entity: new pc.Entity(),
    jamShut: source => jam.attach(0, source),
    releaseJam: source => jam.release(source),
    get jammed() {
      return jam.active;
    },
  };
  const owner = () => {
    const surface = {
      normalSign: 1,
      connected: true,
      touches: other => surface.connected && other.connected,
      merges: 0,
      merge: () => {
        surface.merges++;
      },
    };
    const splash = {
      entity: new pc.Entity(),
      surface,
      clears: 0,
      play: () => {},
      update: () => {},
      clear: () => {
        splash.clears++;
      },
    };

    return {
      pc,
      app: {},
      position: new pc.Vec3(0, 0, 1),
      splash,
    };
  };

  return {
    jam,
    door,
    owner,
  };
};

it("keeps successive door splats indefinitely with no count cap and clears each independently", () => {
  const { jam, door, owner } = fixture();
  const patches = [];
  for (let i = 0; i < 32; i++) {
    patches.push(new LatchGlue(door, null, owner(), new pc.Vec3(0, 0.8, 0)));
    for (const patch of patches) {
      patch.update(25);
      assert.equal(patch.active, true, "old patches must survive later arrivals and their former expiry time");
    }
  }
  for (const patch of patches.slice(0, -1)) {
    patch.clear();
    assert.equal(jam.active, true);
  }
  door.releaseJam(patches.at(-1));
  patches.at(-1).update(0.1);
  assert.equal(patches.at(-1).active, false, "clearing the door still removes persistent residue");
  assert.equal(jam.active, false);
});

it("releases only a fully drained patch while later merged goo remains attached", () => {
  const { jam, door, owner } = fixture();
  const oldOwner = owner(), freshOwner = owner();
  const old = new LatchGlue(door, null, oldOwner, new pc.Vec3(0, 0.8, 0));
  const fresh = new LatchGlue(door, null, freshOwner, new pc.Vec3(0.2, 1, 0));
  old.update(1000);
  assert.equal(old.active, true, "elapsed time alone cannot remove goo");
  oldOwner.splash.surface.drained = true;
  old.update(0.1);
  assert.equal(old.active, false);
  assert.equal(oldOwner.splash.clears, 1);
  assert.equal(fresh.active, true);
  assert.equal(freshOwner.splash.clears, 0);
  assert.equal(jam.active, true);
  fresh.clear();
  assert.equal(jam.active, false);
});

it("keeps each touching patch's lifetime independent, including a fresh impact just before expiry", () => {
  const { jam, door, owner } = fixture();
  const firstOwner = owner(), nextOwner = owner();
  const first = new LatchGlue(door, 20, firstOwner, new pc.Vec3(0, 0.8, 0));
  first.update(19.8);
  const next = new LatchGlue(door, 20, nextOwner, new pc.Vec3(0.3, 1.2, 0));
  next.update(0.1);
  assert.equal(nextOwner.splash.surface.merges, 1);
  first.update(0.3);
  assert.equal(first.active, false);
  assert.equal(next.active, true);
  assert.equal(nextOwner.splash.clears, 0, "expiry of the old patch must not clear fresh goo");
  assert.equal(jam.active, true);
  next.update(19.8);
  assert.equal(next.active, true);
  next.update(0.2);
  assert.equal(next.active, false);
  assert.equal(jam.active, false);
});

it("only merges touching patches on the same face and clears sources independently", () => {
  const { jam, door, owner } = fixture();
  const leftOwner = owner(), rightOwner = owner();
  rightOwner.splash.surface.connected = false;
  const left = new LatchGlue(door, 20, leftOwner, new pc.Vec3(-0.7, 1.2, 0));
  const right = new LatchGlue(door, 20, rightOwner, new pc.Vec3(0.7, 0.4, 0));
  left.update(1);
  right.update(1);
  assert.equal(leftOwner.splash.surface.merges + rightOwner.splash.surface.merges, 0);
  rightOwner.splash.surface.connected = true;
  rightOwner.splash.surface.normalSign = -1;
  right.update(1);
  assert.equal(rightOwner.splash.surface.merges, 0);
  rightOwner.splash.surface.normalSign = 1;
  right.update(1);
  assert.equal(rightOwner.splash.surface.merges, 1);
  right.clear();
  assert.equal(left.active, true);
  assert.equal(jam.active, true);
  jam.clear();
  assert.equal(left.active, false);
  assert.equal(jam.active, false);
});
