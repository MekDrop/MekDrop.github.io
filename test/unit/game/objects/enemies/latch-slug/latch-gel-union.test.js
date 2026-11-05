import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSurface.js";

it("retains all 32 splats through repeated group transfers and releases only the last group's resources", () => {
  class Entity extends pc.Entity {
    addComponent(type, data) {
      this[type] = data;
    }
  }
  class Mesh {
    setPositions(value) {
      this.positions = [...value];
    }
    setIndices(value) {
      this.indices = [...value];
    }
    setNormals() {}
    update() {}
    clear() {}
    destroy() {}
  }
  class MeshInstance {
    constructor(mesh, material, node) {
      this.mesh = mesh;
      this.material = material;
      this.node = node;
      this.visible = true;
    }
  }
  const material = () => ({
    clone: material,
    destroy: () => {},
  });
  const shape = new pc.BoxGeometry();
  const original = {
    mesh: {
      getPositions: out => out.push(...shape.positions),
      getIndices: out => out.push(...shape.indices),
    },
    material: material(),
  };
  const app = new pc.EventHandler();
  app.root = new Entity("root");
  app.graphicsDevice = {};
  const frame = new Entity("door");
  frame.setPosition(10, 2, -4);
  app.root.addChild(frame);
  const create = x => {
    const splash = {
      entity: new Entity(),
      model: { findComponents: () => [{ meshInstances: [original] }] },
    };
    splash.entity.setPosition(10 + x, 3, -4);
    app.root.addChild(splash.entity);
    const surface = new LatchSurface(splash, {
      pc: {
        ...pc,
        Entity,
        Mesh,
        MeshInstance,
      },
      app,
    });
    Object.assign(surface, {
      frame,
      normalSign: 1,
      positions: shape.positions.map((v, i) => i % 3 === 2 ? v * 0.08 + 0.1 : v * 0.8),
      indices: shape.indices,
      sourceVolume: 0.0512,
      age: 0.02,
    });

    return surface;
  };
  const old = create(-0.3), fresh = create(0.3);
  fresh.age = 0;
  assert.equal(old.touches(fresh), false);
  fresh.age = 0.02;
  assert.equal(old.touches(fresh), true, "first wet contact must merge before flattening can pull the outlines apart");
  old.merge(fresh);
  const extra = Array.from({ length: 30 }, (_, index) => create((index % 7 - 3) * 0.12));
  const joined = [old, fresh];
  for (const surface of extra) {
    surface.merge(fresh);
    joined.push(surface);
    for (const member of joined) {
      assert.equal(member.visibleEntity, surface.visibleEntity, "merging another slime must retain every earlier member");
      assert.equal(member.instance.visible, false);
    }
  }
  const union = fresh.visibleEntity;
  app.fire("prerender");
  assert.equal(old.visibleEntity, union);
  assert.equal(old.instance.visible, false);
  assert.equal(fresh.instance.visible, false);
  assert.ok(union.render.meshInstances[0].mesh.positions.length > 0);
  old.clear();
  old.destroy();
  app.fire("prerender");
  assert.equal(fresh.visibleEntity, union);
  assert.equal(union.parent, app.root);
  assert.equal(fresh.instance.visible, false);
  fresh.clear();
  assert.equal(union.parent, app.root, "clearing the first two splats leaves the other 30 visible");
  for (const surface of extra) {
    assert.equal(surface.visibleEntity, union);
    surface.clear();
    surface.destroy();
  }
  assert.equal(union.parent, null);
  assert.equal(app.hasEvent("prerender"), false);
  fresh.destroy();
});
