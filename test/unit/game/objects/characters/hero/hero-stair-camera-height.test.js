import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroStairCameraHeight } from "../../../../../../src/game/objects/characters/hero/HeroStairCameraHeight.js";

it("eases both a riser and a step down without moving the capsule", () => {
  for (const height of [.2, -.2]) {
    const camera = new HeroStairCameraHeight();
    camera.update(0, 1 / 60, {
      onStairs: true,
      freeMotion: false,
    });
    const offset = camera.update(height, 1 / 60, {
      onStairs: true,
      freeMotion: false,
    });
    assert.ok(Math.abs(height + offset) < .04, "A 20cm step must not become a one-frame eye jump");
    let tail = offset;
    for (let frame = 0; frame < 60; frame++) {
      tail = camera.update(height, 1 / 60, {
        onStairs: false,
        freeMotion: false,
      });
    }
    assert.equal(tail, 0, "Settle exactly on the landing after leaving the stairs");
  }
});

it("has the same response at 30, 60 and 120 frames per second", () => {
  const offsets = [];
  for (const fps of [30, 60, 120]) {
    const camera = new HeroStairCameraHeight();
    camera.update(0, 1 / fps, {
      onStairs: true,
      freeMotion: false,
    });
    let offset;
    for (let i = 0; i < fps / 2; i++) {
      offset = camera.update(.2, 1 / fps, {
        onStairs: true,
        freeMotion: false,
      });
    }
    offsets.push(offset);
  }
  assert.ok(Math.max(...offsets) - Math.min(...offsets) < 1e-9);
});

it("snaps for teleports, jumps and resets rather than delaying free movement", () => {
  const camera = new HeroStairCameraHeight();
  camera.update(0, .016, {
    onStairs: true,
    freeMotion: false,
  });
  assert.equal(camera.update(4, .016, {
    onStairs: true,
    freeMotion: false,
  }), 0);
  camera.update(4.2, .016, {
    onStairs: true,
    freeMotion: false,
  });
  assert.equal(camera.update(4.25, .016, {
    onStairs: true,
    freeMotion: true,
  }), 0);
  camera.reset();
  assert.equal(camera.update(1, .016, {
    onStairs: true,
    freeMotion: false,
  }), 0);
});

it("leaves ordinary walking immediate and bounds stair lag", () => {
  const camera = new HeroStairCameraHeight();
  camera.update(0, .016, {
    onStairs: false,
    freeMotion: false,
  });
  assert.equal(camera.update(.1, .016, {
    onStairs: false,
    freeMotion: false,
  }), 0);
  for (let i = 1; i < 100; i++) {
    assert.ok(Math.abs(camera.update(i * .2, .008, {
      onStairs: true,
      freeMotion: false,
    })) <= .240001);
  }
});
