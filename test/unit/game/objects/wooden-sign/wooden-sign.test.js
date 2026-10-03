import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Entity } from "playcanvas";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("arrow-signpost.glb?url")) {
      return { url: 'data:text/javascript,export default "sign.glb"', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { WoodenSign } = await import("../../../../../src/game/objects/wooden-sign/WoodenSign.js");
hooks.deregister();

test("sign collision excludes lettering and preserves independent scale and facing", () => {
  const previousDocument = globalThis.document;
  const context = {
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0 }),
    save() {}, translate() {}, rotate() {}, fillText() {}, restore() {},
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  class TestEntity extends Entity {
    addComponent(type, options) { this[type] = options; }
    destroy() { this.c = {}; super.destroy(); }
    destroy() { this.c = {}; super.destroy(); }
  }
  class Resource {
    setSource() {}
    update() {}
    destroy() {}
  }
  const graphs = [];
  const modelLibrary = {
    instantiate() {
      const graph = new TestEntity("Sign");
      const wood = new TestEntity("Sign wood");
      const inscription = new TestEntity("Sign inscription");
      wood.render = { entity: wood, meshInstances: [{ material: null }] };
      inscription.render = { entity: inscription, meshInstances: [{ material: null }] };
      wood.c.render = wood.render;
      inscription.c.render = inscription.render;
      wood.c.render = wood.render;
      inscription.c.render = inscription.render;
      graph.addChild(wood);
      graph.addChild(inscription);
      graphs.push(graph);
      return graph;
    },
  };
  try {
    for (const rotation of [0, 90, 180, 270, { x: 0, y: -45, z: 0 }]) {
      const sign = new WoodenSign({
        pc: { Entity: TestEntity, Model: Resource, Texture: Resource, StandardMaterial: Resource, Color: Resource },
        app: { graphicsDevice: {} }, modelLibrary,
        definition: { id: "sign", text: "Way out", position: { x: 3, y: 2, z: 4 }, scale: 2, rotation },
      });
      const root = sign.entity;
      assert.equal(root.collision.type, "mesh");
      assert.equal(root.rigidbody.type, "static");
      assert.equal(root.collision.model.meshInstances.length, 1);
      assert.equal(root.collision.model.meshInstances[0], graphs.at(-1).children[0].render.meshInstances[0]);
      assert.deepEqual(root.getLocalScale().toArray(), [1, 1, 1]);
      assert.deepEqual(root.children[0].getLocalScale().toArray(), [2, 2, 2]);
      assert.deepEqual(graphs.at(-1).getLocalScale().toArray(), [2, 2, 2]);
      assert.deepEqual(root.getLocalPosition().toArray(), [3, 2, 4]);
      const yaw = typeof rotation === "number" ? rotation : rotation.y;
      assert.ok(Math.abs(root.forward.x + Math.sin(yaw * Math.PI / 180)) < 1e-6);
      assert.ok(Math.abs(root.forward.z + Math.cos(yaw * Math.PI / 180)) < 1e-6);
      assert.equal(sign.surfaceHeightAt, undefined);
      sign.destroy();
      assert.equal(graphs.at(-1).parent, null);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});
