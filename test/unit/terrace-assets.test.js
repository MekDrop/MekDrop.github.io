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
  const animation = json.animations.find(({ name }) => name === "Open");
  assert.equal(names.filter((name) => name === "Terrace door hinge").length, 1);
  assert.equal(names.filter((name) => /door plank/.test(name)).length, 5);
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
  assert.equal(stairhead.filter((name) => /Descending terrace stair/.test(name)).length, 5);
  assert.ok(stairhead.includes("Terrace rectangular lintel"));
  assert.ok(stairhead.includes("Deep terrace stairwell shadow"));
  assert.ok(!stairhead.includes("Terrace dark stairwell"));
  const tray = glb("serving-tray").json.nodes.map(({ name }) => name);
  assert.ok(tray.includes("Raised oval tray rim"));
  assert.equal(tray.filter((name) => /^Tray handle/.test(name)).length, 2);
});

it("mounts matching ring handles on opposite faces of the animated leaf", () => {
  const { json } = glb("terrace-door");
  const outside = json.nodes.find((node) => node.name === "Terrace door outside ring handle");
  const inside = json.nodes.find((node) => node.name === "Terrace door inside ring handle");
  const hinge = json.nodes.find((node) => node.name === "Terrace door hinge");
  assert.ok(outside && inside);
  assert.ok(hinge.children.includes(json.nodes.indexOf(outside)));
  assert.ok(hinge.children.includes(json.nodes.indexOf(inside)));
  assert.equal(outside.translation[0], inside.translation[0]);
  assert.equal(outside.translation[1], inside.translation[1]);
  assert.ok(outside.translation[2] > 0.05);
  assert.ok(inside.translation[2] < -0.05);
  assert.ok(Math.abs(outside.rotation[0]) > 0.7);
  assert.ok(Math.abs(inside.rotation[0]) > 0.7);
});
