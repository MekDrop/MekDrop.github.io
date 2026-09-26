import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import { it } from "node:test";

function glb(name) {
  const url = new URL(
    `../../src/game/models/castle/leisure/${name}.glb`,
    import.meta.url,
  );
  const buffer = readFileSync(url);
  const json = JSON.parse(
    buffer.subarray(20, 20 + buffer.readUInt32LE(12)),
  );
  return { json, url };
}

it("uses one rectangular outward-opening terrace door", () => {
  const { json, url } = glb("terrace-door");
  const names = json.nodes.map(({ name }) => name);
  const planks = json.nodes
    .filter(({ name }) => /door plank/.test(name))
    .sort((left, right) => left.translation[0] - right.translation[0]);
  const animation = json.animations.find(({ name }) => name === "Open");
  assert.equal(names.filter((name) => name === "Terrace door hinge").length, 1);
  assert.equal(planks.length, 5);
  for (let index = 1; index < planks.length; index += 1) {
    const previous = planks[index - 1];
    const current = planks[index];
    const previousBounds = json.accessors[
      json.meshes[previous.mesh].primitives[0].attributes.POSITION
    ];
    const currentBounds = json.accessors[
      json.meshes[current.mesh].primitives[0].attributes.POSITION
    ];
    assert.ok(
      previous.translation[0] + previousBounds.max[0] >=
        current.translation[0] + currentBounds.min[0],
      `${previous.name} must meet ${current.name}`,
    );
  }
  assert.equal(animation.channels.length, 1);
  assert.equal(
    json.nodes[animation.channels[0].target.node].name,
    "Terrace door hinge",
  );
  assert.equal(animation.channels[0].target.path, "rotation");
  accessSync(new URL(url.href.replace(/\.glb$/, ".blend")));
});

it("packages the roof stairhead and serving tray with editable sources", () => {
  for (const name of ["terrace-stairhead", "serving-tray"]) {
    const { json, url } = glb(name);
    accessSync(new URL(url.href.replace(/\.glb$/, ".blend")));
    assert.ok(json.meshes.length > 0);
  }
  const stairhead = glb("terrace-stairhead").json.nodes.map(({ name }) => name);
  assert.equal(stairhead.filter((name) => /Descending terrace stair/.test(name)).length, 0);
  assert.ok(stairhead.includes("Terrace stairhead frame"));
  for (const part of [
    "Terrace stairhead side wall -1",
    "Terrace stairhead side wall 1",
    "Terrace rectangular lintel",
    "Terrace lintel face",
  ]) {
    assert.ok(!stairhead.includes(part));
  }
  assert.ok(!stairhead.includes("Deep terrace stairwell shadow"));
  assert.ok(!stairhead.includes("Terrace dark stairwell"));
  assert.ok(!stairhead.includes("Terrace stairhead roof"));
  const tray = glb("serving-tray").json.nodes.map(({ name }) => name);
  assert.ok(tray.includes("Raised oval tray rim"));
  assert.equal(tray.filter((name) => /^Tray handle/.test(name)).length, 2);
});

it("mounts one-axis ring handle assemblies on both door faces", () => {
  const { json } = glb("terrace-door");
  const hinge = json.nodes.find((node) => node.name === "Terrace door hinge");
  for (const side of ["inside", "outside"]) {
    const assembly = json.nodes.find(
      (node) => node.name === `Terrace door ${side} handle assembly`,
    );
    const mount = json.nodes.find(
      (node) => node.name === `Terrace door ${side} handle mount`,
    );
    const pivot = json.nodes.find(
      (node) => node.name === `Terrace door ${side} handle pivot`,
    );
    const ring = json.nodes.find(
      (node) => node.name === `Terrace door ${side} ring handle`,
    );
    assert.ok(assembly && mount && pivot && ring);
    assert.ok(hinge.children.includes(json.nodes.indexOf(assembly)));
    assert.ok(assembly.children.includes(json.nodes.indexOf(mount)));
    assert.ok(assembly.children.includes(json.nodes.indexOf(pivot)));
    assert.ok(pivot.children.includes(json.nodes.indexOf(ring)));
    assert.equal(assembly.extras.handleType, "single-mount ring");
    assert.equal(pivot.extras.movementAxis, "X");
    assert.equal(pivot.extras.minimumAngleDegrees, -65);
    assert.equal(pivot.extras.maximumAngleDegrees, 65);
    assert.ok(mount.mesh !== undefined);
    assert.ok(ring.mesh !== undefined);
  }
});
