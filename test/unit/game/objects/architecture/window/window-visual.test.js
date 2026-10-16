import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith("-window.glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { Window } = await import("../../../../../../src/game/objects/architecture/window/Window.js");
const { WindowModules } = await import("../../../../../../src/game/objects/architecture/window/WindowModules.js");
hooks.deregister();

test("larger windows repeat imported panes, dividers and masonry courses", () => {
  const data = readFileSync(new URL("../../../../../../src/game/models/castle/windows/room-window.glb", import.meta.url));
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
    const data = readFileSync(new URL(`../../../../../../src/game/models/castle/windows/${variant}-window.glb`, import.meta.url));
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
          const upright = gltf.nodes.find((node) => node.name === "Oak frame upright 1");
          const uprightEntity = new pc.Entity(upright.name);
          uprightEntity.setLocalPosition(...upright.translation);
          visual.addChild(uprightEntity);
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
          const railFront = (railEntity.getLocalPosition().z + railBounds.max[2]) * scale.z;
          const uprightBounds = gltf.accessors[gltf.meshes[upright.mesh].primitives[0].attributes.POSITION];
          const uprightFront = (uprightEntity.getLocalPosition().z + uprightBounds.max[2]) * scale.z;
          assert.ok(Math.abs(railFront - uprightFront) > 0.0019, `${variant}/${height}: timber joint faces stay separated`);
          const uprightOuter = (uprightEntity.getLocalPosition().x + uprightBounds.max[0] * uprightEntity.getLocalScale().x) * scale.x;
          assert.ok(uprightOuter > scale.x / 2 + 0.0039, `${variant}/${height}: upright extends beyond the wall's 2mm clearance`);
          const railOuter = railBounds.max[0] * railEntity.getLocalScale().x * scale.x;
          assert.ok(railOuter > scale.x / 2 + 0.0039, `${variant}/${height}: rail ends extend into jambs`);
          const uprightTop = (uprightEntity.getLocalPosition().y + uprightBounds.max[1] * uprightEntity.getLocalScale().y) * scale.y;
          const uprightBottom = (uprightEntity.getLocalPosition().y + uprightBounds.min[1] * uprightEntity.getLocalScale().y) * scale.y;
          assert.ok(uprightTop > height + 0.0039, `${variant}/${height}: upright extends into lintel`);
          assert.ok(uprightBottom < -0.0039, `${variant}/${height}: upright extends into sill`);
          parent.destroy();
        }
      }
    }
  }
});

test("open windows retain the surround and remove glazing and internal dividers", () => {
  const data = readFileSync(new URL("../../../../../../src/game/models/castle/windows/room-window.glb", import.meta.url));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const app = { _entityIndex: {} };
  const parent = new pc.Entity("Open window", app);
  let visual;
  const models = {
    instantiate: () => {
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

test("glazing stays between the front and back of every timber joint", () => {
  class TestEntity extends pc.Entity {
    addComponent() {}
  }
  for (const variant of ["room", "hall", "slit"]) {
    const data = readFileSync(new URL(`../../../../../../src/game/models/castle/windows/${variant}-window.glb`, import.meta.url));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    for (const depth of [0.25, 0.3, 0.75]) {
      const app = { _entityIndex: {} };
      const visual = new pc.Entity("Glazing", app);
      for (const node of gltf.nodes) {
        const entity = new pc.Entity(node.name, app);
        entity.setLocalPosition(...node.translation);
        visual.addChild(entity);
      }
      const parent = new pc.Entity();
      Window.addVisual({
        ...pc,
        Entity: TestEntity,
      }, { instantiate: () => visual }, parent, {
        from: {
          x: 0,
          y: 0,
          z: 0,
        },
        to: {
          x: 1,
          y: 1.5,
          z: 0,
        },
        depth,
        variant,
      });
      const pane = visual.findByName("Amber glass pane 0 0");
      const sourcePane = gltf.nodes.find(node => node.name === "Amber glass pane 0 0");
      const paneBounds = gltf.accessors[gltf.meshes[sourcePane.mesh].primitives[0].attributes.POSITION];
      for (const node of gltf.nodes.filter(node => /^(Oak frame |Central oak mullion|Fine oak transom)/.test(node.name))) {
        const timber = visual.find(entity => entity.name.startsWith(node.name.startsWith("Fine oak transom") ? "Fine oak transom" : node.name))[0];
        const bounds = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
        assert.ok(pane.getLocalPosition().z + paneBounds.min[2] > timber.getLocalPosition().z + bounds.min[2], `${variant}/${depth}/${node.name}: glass stays ahead of inner timber face`);
        assert.ok(pane.getLocalPosition().z + paneBounds.max[2] < timber.getLocalPosition().z + bounds.max[2], `${variant}/${depth}/${node.name}: glass stays behind outer timber face`);
      }
      parent.destroy();
    }
  }
});