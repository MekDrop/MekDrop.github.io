import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

function gltf(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));

  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
}

function paths(document) {
  const parents = new Map();
  for (const [index, node] of document.nodes.entries()) {
    for (const child of node.children ?? []) {
      parents.set(child, index);
    }
  }

  return document.nodes.map((node, index) => {
    let path = node.name;
    while (parents.has(index)) {
      index = parents.get(index);
      path = `${document.nodes[index].name}/${path}`;
    }

    return path;
  });
}

it("binds all burner channels on both heroes without overwriting the runtime root scale", () => {
  const base = "../../../../../../src/game/models/hero/";
  for (const [poses, hero] of [
    ["tools/alchemical-burner-poses.glb", "hero.glb"],
    ["tools/alchemical-burner-special-poses.glb", "variants/special-artojas/special-artojas.glb"],
  ]) {
    const source = gltf(base + poses);
    const sourcePaths = paths(source);
    const destination = new Set(paths(gltf(base + hero)));
    assert.deepEqual(source.animations.map(animation => animation.name).sort(), ["BurnBushHigh", "BurnBushLow", "BurnBushMiddle"]);
    for (const animation of source.animations) {
      for (const channel of animation.channels) {
        const path = sourcePaths[channel.target.node];
        assert.ok(destination.has(path), `unbound ${poses}: ${path}`);
        assert.ok(path.includes("/"), "the model root belongs to the runtime, not the clip");
      }
    }
  }
});
