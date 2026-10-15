import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("-window.glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { Window } = await import("../../../../../src/game/objects/window/Window.js");
const { WindowModules } = await import("../../../../../src/game/objects/window/WindowModules.js");
hooks.deregister();

test("larger windows repeat imported panes, dividers and masonry courses", () => {
  const data = readFileSync(new URL("../../../../../src/game/models/castle/windows/room-window.glb", import.meta.url));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  for (const [width, height, columns, rows, courses] of [[0.5, 0.75, 2, 2, 4], [1, 1.5, 2, 3, 6], [1.5, 2.25, 3, 5, 9]]) {
    const app = { _entityIndex: {} };
    const visual = new pc.Entity("Window modules", app);
    for (const node of gltf.nodes) {
      const entity = new pc.Entity(node.name, app);
      entity.setLocalPosition(...node.translation);
      visual.addChild(entity);
    }
    WindowModules.fit(visual, {
      width,
      height,
      role: "room",
    });
    const panes = visual.children.filter(node => node.name.startsWith("Amber glass pane"));
    assert.equal(panes.length, columns * rows);
    assert.equal(visual.children.filter(node => node.name.startsWith("Fine oak transom")).length, rows - 1);
    assert.equal(visual.children.filter(node => node.name.startsWith("Central oak mullion")).length, columns - 1);
    for (const side of [1, -1]) {
      assert.equal(visual.children.filter(node => node.name.startsWith(`Stone jamb course ${side} `)).length, courses);
    }
    for (const pane of panes) {
      const position = pane.getLocalPosition();
      const scale = pane.getLocalScale();
      assert.ok(position.x - 0.25 * scale.x >= -0.500001);
      assert.ok(position.x + 0.25 * scale.x <= 0.500001);
      assert.ok(position.y - 0.25 * scale.y >= -0.000001);
      assert.ok(position.y + 0.25 * scale.y <= 1.000001);
    }
    assert.ok(visual.findByName("Projecting stone sill"));
    assert.ok(visual.findByName("Oak frame rail -1"));
    visual.destroy();
  }
});

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
          const app = { _entityIndex: {} };
          const visual = new pc.Entity("Window modules", app);
          const sillEntity = new pc.Entity(sill.name);
          sillEntity.setLocalPosition(...sill.translation);
          visual.addChild(sillEntity);
          const railEntity = new pc.Entity(rail.name);
          railEntity.setLocalPosition(...rail.translation);
          visual.addChild(railEntity);
          const parent = new pc.Entity();
          Window.addVisual({
            ...pc,
            Entity: TestEntity,
          }, { instantiate: () => visual }, parent, {
            from: {
              x: 2,
              y: 3,
              z: 4,
            },
            to: {
              x: alongX ? 2.5 : 2,
              y: 3 + height,
              z: alongX ? 4 : 4.5,
            },
            variant,
            facing,
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

test("open windows retain the surround and remove glazing and internal dividers", () => {
  const data = readFileSync(new URL("../../../../../src/game/models/castle/windows/room-window.glb", import.meta.url));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const app = { _entityIndex: {} };
  const parent = new pc.Entity("Open window", app);
  let visual;
  const models = {
    instantiate() {
      visual = new pc.Entity("Window", app);
      for (const node of gltf.nodes) {
        const entity = new pc.Entity(node.name, app);
        entity.setLocalPosition(...node.translation);
        visual.addChild(entity);
      }
      return visual;
    },
  };
  Window.addVisual(pc, models, parent, {
    id: "lookout",
    from: {
      x: 0,
      y: 0,
      z: 0,
    },
    to: {
      x: 1.25,
      y: 1.75,
      z: 0,
    },
    open: true,
  });
  assert.equal(visual.find(node => /^(Amber glass pane |Fine oak transom |Central oak mullion)/.test(node.name)).length, 0);
  assert.ok(visual.findByName("Projecting stone sill"));
  assert.ok(visual.findByName("Oak frame rail -1"));
  parent.destroy();
});
