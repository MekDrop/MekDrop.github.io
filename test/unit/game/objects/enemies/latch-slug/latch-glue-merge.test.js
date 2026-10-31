import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { DoorJam } from "../../../../../../src/game/objects/architecture/door/DoorJam.js";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";

it("coalesces same-face impacts into one surface, refreshes its lifetime and clears all restraints together", () => {
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
      absorbed: 0,
      absorb: () => {
        surface.absorbed++;
      },
    };
    const splash = {
      entity: new pc.Entity(),
      surface,
      clears: 0,
      play: () => {
        splash.entity.enabled = true;
      },
      update: () => {},
      clear: () => {
        splash.clears++;
        splash.entity.enabled = false;
      },
    };

    return {
      pc,
      app: {},
      position: new pc.Vec3(0, 0, 1),
      splash,
    };
  };
  const firstOwner = owner(), nextOwner = owner();
  const first = new LatchGlue(door, 20, firstOwner, new pc.Vec3(0, 0.8, 0));
  first.update(19);
  const next = new LatchGlue(door, 20, nextOwner, new pc.Vec3(0.3, 1.2, 0));
  assert.equal(firstOwner.splash.surface.absorbed, 1);
  assert.equal(firstOwner.splash.clears, 0);
  assert.equal(nextOwner.splash.clears, 0);
  first.update(2);
  next.update(100);
  assert.equal(first.active, true);
  assert.equal(next.active, true);
  next.clear();
  assert.equal(first.active, false);
  assert.equal(next.active, false);
  assert.equal(jam.active, false);
  assert.equal(firstOwner.splash.clears, 1);
});
