import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("-window.glb?url")) {
      return { url: `data:text/javascript,export default ${JSON.stringify(specifier)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { Window } = await import("../../../../../src/game/objects/window/Window.js");
hooks.deregister();

test("window sills overlap masonry without sharing its top plane at every size and facing", () => {
  class TestEntity extends pc.Entity {
    addComponent() {}
  }
  for (const variant of ["room", "hall", "slit"]) {
    const data = readFileSync(new URL(`../../../../../src/game/models/castle/windows/${variant}-window.glb`, import.meta.url));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const sill = gltf.nodes.find((node) => node.name === "Projecting stone sill");
    const bounds = gltf.accessors[gltf.meshes[sill.mesh].primitives[0].attributes.POSITION];
    const rail = gltf.nodes.find((node) => node.name === "Oak frame rail -1");
    const railBounds = gltf.accessors[gltf.meshes[rail.mesh].primitives[0].attributes.POSITION];
    const pane = gltf.nodes.find((node) => node.name === "Amber glass pane 0 0");
    const paneBounds = gltf.accessors[gltf.meshes[pane.mesh].primitives[0].attributes.POSITION];
    for (const height of [0.25, 0.75, 1.25, 2]) {
      for (const alongX of [true, false]) {
        for (const facing of [-1, 1]) {
          const visual = new pc.Entity();
          const sillEntity = new pc.Entity(sill.name);
          sillEntity.setLocalPosition(...sill.translation);
          visual.addChild(sillEntity);
          const railEntity = new pc.Entity(rail.name);
          railEntity.setLocalPosition(...rail.translation);
          visual.addChild(railEntity);
          const parent = new pc.Entity();
          Window.addVisual({ ...pc, Entity: TestEntity }, { instantiate: () => visual }, parent, {
            from: { x: 2, y: 3, z: 4 },
            to: { x: alongX ? 2.5 : 2, y: 3 + height, z: alongX ? 4 : 4.5 },
            variant, facing,
          });
          const position = visual.getLocalPosition();
          const scale = visual.getLocalScale();
          const sillY = sillEntity.getLocalPosition().y;
          const sillTop = position.y + (sillY + bounds.max[1]) * scale.y;
          const sillBottom = position.y + (sillY + bounds.min[1]) * scale.y;
          assert.ok(Math.abs(sillTop - 3.002) < 1e-7, `${variant}/${height}/${facing}: separate coplanar faces`);
          assert.ok(sillBottom < 3, `${variant}/${height}/${facing}: retain overlap below the aperture`);
          const railY = railEntity.getLocalPosition().y;
          const railBottom = position.y + (railY + railBounds.min[1]) * scale.y;
          const railTop = position.y + (railY + railBounds.max[1]) * scale.y;
          const paneBottom = position.y + (pane.translation[1] + paneBounds.min[1]) * scale.y;
          assert.ok(railBottom < sillTop - 0.0009, `${variant}/${height}: frame seats into sill`);
          assert.ok(railTop > paneBottom, `${variant}/${height}: frame still covers glazing edge`);
          assert.equal(position.y, 3);
          assert.ok(Math.abs(position.y + scale.y - (3 + height)) < 1e-7);
          assert.equal(scale.x, 0.5);
          parent.destroy();
        }
      }
    }
  }
});
