import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroLadderClimb } from "../../../../../src/game/objects/hero/HeroLadderClimb.js";

function fixture(topLandings) {
  const controller = new HeroLadderClimb();
  let opened = 0;
  const bottom = { x: 0, y: 0, z: 0 }, top = { x: 1, y: 3, z: 0 };
  const release = controller.register({ topLandings, landing: end => end === "bottom" ? bottom : top, climbFacing: { x: -1, z: 0 }, openHatch() { opened++; } });
  const options = { position: { ...bottom }, input: { x: 0, y: 1 }, movement: { x: -1, z: 0 }, jump: false, allowed: true };
  return { controller, options, release, top, opened: () => opened };
}

function advance(f, seconds, roofHeight = f.top.y) {
  let motion;
  for (let time = 0; time < seconds; time += 1 / 120) {
    const position = f.options.position;
    const nearRoof = Math.hypot(position.x - f.top.x, position.z - f.top.z) < 0.1;
    if (nearRoof && position.y >= f.top.y - 0.08) position.y = roofHeight;
    motion = f.controller.update(1 / 120, { ...f.options, grounded: nearRoof && position.y >= roofHeight - 0.001 });
    if (!motion) return null;
    position.x += motion.velocity.x / 120;position.y += motion.velocity.y / 120;position.z += motion.velocity.z / 120;
  }
  return motion;
}

it("walks into a ladder, moves continuously, pauses, reverses, and detaches on jump", () => {
  const f = fixture();
  const up = f.controller.update(1 / 60, f.options);
  assert.equal(up.velocity.y, 1.5);
  assert.equal(f.options.position.y, 0, "no instant teleport");
  f.options.position.y = 1;
  f.options.input.y = 0;
  f.options.movement = null;
  assert.equal(f.controller.update(1 / 60, f.options).velocity.y, 0);
  f.options.input.y = -1;
  f.options.movement = { x: 1, z: 0 };
  assert.equal(f.controller.update(1 / 60, f.options).velocity.y, -1.5);
  f.options.jump = true;
  assert.equal(f.controller.update(1 / 60, f.options), null);
  assert.ok(f.opened() > 0);
});

it("steps off beside either rail according to lateral input at the top", () => {
  for (const side of [-1, 1]) {
    const f = fixture([{ x: 0, y: 3, z: -1 }, { x: 0, y: 3, z: 1 }]);
    f.controller.update(1 / 60, f.options);
    f.options.position.y = 2.99;
    f.options.movement = { x: 0, z: side };
    const brace = f.controller.update(1 / 60, f.options);
    assert.equal(brace.velocity.z, 0, "brace before moving the body");
    const motion = advance(f, 1);
    assert.ok(f.options.position.z * side > 0, "step toward the selected side");
    assert.equal(motion.velocity.x, 0, "do not step off along the ladder's front");
  }
});

it("braces before leaving the roof and then lowers onto the ladder", () => {
  const f = fixture();f.options.position = { ...f.top };
  const align = f.controller.update(1 / 60, f.options);
  assert.equal(align.velocity.x, 0);
  assert.equal(align.velocity.y, 0);
  advance(f, 1);
  assert.ok(f.options.position.x < f.top.x);
  advance(f, 2);
  assert.ok(f.options.position.y < f.top.y - 0.2);
});

it("finishes descending through the hatch after movement is released", () => {
  const f = fixture();f.options.position = { ...f.top };
  f.controller.update(1 / 60, f.options);
  f.options.movement = null;f.options.input.y = 0;
  advance(f, 4);
  assert.ok(f.options.position.y <= 1.41);
  assert.equal(f.controller.update(1 / 60, f.options).velocity.y, 0);
});

it("finishes ascending through the roof slab after movement is released", () => {
  const f = fixture();f.controller.update(1 / 60, f.options);
  f.options.position.y = 2;f.options.movement = null;f.options.input.y = 0;
  assert.ok(f.controller.update(1 / 60, f.options).velocity.y > 0);
  f.options.position.y = 2.95;
  assert.equal(f.controller.update(1 / 60, f.options).velocity.x, 0, "plant before transferring weight");
  assert.equal(advance(f, 4), null);
});

it("exits onto the top landing and requires fresh movement before attaching again", () => {
  const f = fixture();f.controller.update(1 / 60, f.options);
  f.options.position.y = 2.95;
  assert.equal(f.controller.update(1 / 60, f.options).velocity.x, 0);
  assert.equal(advance(f, 4), null);
  assert.equal(f.controller.update(1, f.options), null);
  f.options.input.y = 0;f.controller.update(1, f.options);f.options.input.y = 1;
  assert.ok(f.controller.update(1 / 60, f.options));
});

it("does not attach while walking away or using a tool, and safely releases removed ladders", () => {
  const f = fixture();f.options.movement.x = 1;
  assert.equal(f.controller.update(1 / 60, f.options), null);
  f.options.movement.x = -1;f.options.allowed = false;
  assert.equal(f.controller.update(1 / 60, f.options), null);
  f.options.allowed = true;assert.ok(f.controller.update(1 / 60, f.options));
  f.release();assert.equal(f.controller.update(1, f.options), null);
});

it("releases onto solid roof support above the authored landing height", () => {
  const f = fixture();f.controller.update(1 / 60, f.options);
  f.options.position.y = 2.95;f.controller.update(1 / 60, f.options);
  assert.equal(advance(f, 4, f.top.y + 0.14), null);
  assert.ok(f.options.position.y > f.top.y + 0.1);
});

it("detaches if collision or relocation takes the hero away from the ladder", () => {
  const f = fixture();f.controller.update(1 / 60, f.options);
  f.options.position = { x: 3, y: 3.2, z: 2 };
  assert.equal(f.controller.update(1 / 60, f.options), null);
});

it("reversing a roof descent exits at the top instead of climbing beyond the rails", () => {
  const f = fixture();f.options.position = { ...f.top };
  f.controller.update(1 / 60, f.options);
  f.options.position = { x: 0, y: 2.99, z: 0 };
  f.options.movement = { x: 1, z: 0 };f.options.input.y = -1;
  const motion = f.controller.update(0.1, f.options);
  assert.ok(motion.velocity.x > 0, "move onto the roof landing");
  assert.ok(f.options.position.y + motion.velocity.y * 0.1 <= f.top.y);
  f.options.position.y = f.top.y + 0.02;
  assert.ok(f.controller.update(1 / 60, f.options).velocity.y <= 0, "never climb higher above the endpoint");
});

it("bounds each physics step to the remaining ladder height", () => {
  const f = fixture();f.controller.update(1 / 60, f.options);
  f.options.position.y = 2.8;
  const motion = f.controller.update(0.25, f.options);
  assert.ok(f.options.position.y + motion.velocity.y * 0.25 <= f.top.y);
});

it("uses the roof transition at the hatch and the rung pose below it", () => {
  const f = fixture();f.options.position = { ...f.top };
  assert.ok(f.controller.update(1 / 60, f.options).topProgress > 0.95);
  const lowering = advance(f, 2.5);
  assert.ok(lowering.topProgress < 0.4);
  assert.equal(advance(f, 0.8).topProgress, 0);
});

it("stays crouched over the opening and straightens only after stepping sideways", () => {
  const f = fixture([{ x: 0, y: 3, z: -1 }, { x: 0, y: 3, z: 1 }]);
  f.controller.update(1 / 60, f.options);
  f.options.position.y = 3;
  assert.ok(f.controller.update(1 / 60, f.options).topProgress < 0.42);
  const halfway = advance(f, 1);
  assert.ok(halfway.topProgress > 0.4 && halfway.topProgress < 1);
  assert.equal(halfway.topSide, -1);
});

it("stops a released descent at the safe handhold without stepping past it", () => {
  const f = fixture();f.options.position = { ...f.top };
  f.controller.update(1 / 60, f.options);
  f.options.movement = null;f.options.input.y = 0;
  advance(f, 4);
  assert.ok(f.options.position.y >= 1.4 - 0.000001 && f.options.position.y <= 1.41);
});

it("keeps the authored root planted when physics nudges the capsule at the rim", () => {
  const f = fixture([{ x: 0.12, y: 3, z: -1 }]);
  f.top.x = 0.12;f.top.z = -1;
  f.controller.update(1 / 60, f.options);
  f.options.position.y = 3;
  advance(f, 1.3);
  const before = f.controller.update(0, f.options);
  const renderedX = f.options.position.x + before.rootCorrection.x;
  f.options.position.x += 0.04;
  const after = f.controller.update(0, f.options);
  assert.ok(Math.abs(f.options.position.x + after.rootCorrection.x - renderedX) < 0.000001);
  assert.ok(Math.abs(after.rootCorrection.x) <= 0.08, "correction remains within the capsule clearance");
});
