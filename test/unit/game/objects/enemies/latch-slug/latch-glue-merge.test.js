import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { DoorJam } from "../../../../../../src/game/objects/architecture/door/DoorJam.js";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";

it("coalesces repeated same-face impacts without extending the original residue lifetime", () => {
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
  first.update(1);
  const next = new LatchGlue(door, 20, nextOwner, new pc.Vec3(0.3, 1.2, 0));
  next.update(0.1);
  assert.equal(firstOwner.splash.surface.absorbed, 1);
  assert.equal(firstOwner.splash.clears, 0);
  assert.equal(nextOwner.splash.clears, 0);
  first.update(1);
  next.update(100);
  assert.equal(first.active, true);
  assert.equal(next.active, true);
  const members = [next];
  // Sustained waves must eventually release the original mass and all owners,
  // even when a fresh impact arrives just before every update.
  for (let i = 0; i < 18; i++) {
    const member = new LatchGlue(door, 20, owner(), new pc.Vec3(0.3, 1.2, 0));
    member.update(0.1);
    members.push(member);
    first.update(1);
  }
  assert.equal(first.active, false);
  assert.equal(next.active, false);
  assert.ok(members.every(member => !member.active));
  assert.equal(jam.active, false);
  assert.equal(firstOwner.splash.clears, 1);

  const leftOwner = owner(), rightOwner = owner();
  rightOwner.splash.surface.connected = false;
  const left = new LatchGlue(door, 20, leftOwner, new pc.Vec3(-0.7, 1.2, 0));
  const right = new LatchGlue(door, 20, rightOwner, new pc.Vec3(0.7, 0.4, 0));
  left.update(1);
  right.update(1);
  assert.equal(leftOwner.splash.surface.absorbed, 0);
  assert.equal(rightOwner.splash.surface.absorbed, 0);
  // Flow can bring previously independent wet footprints into contact later.
  left.update(1);
  rightOwner.splash.surface.connected = true;
  right.update(1);
  assert.equal(leftOwner.splash.surface.absorbed, 1);
  right.clear();
  assert.equal(left.active, false);
  assert.equal(jam.active, false);
});
