import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../../../../../src/game/objects/castle-props/painting/Painting.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace("export class", "class");
class Entity {
  children = [];
  tags = { add: () => {} };
  addChild(child) {
    this.children.push(child);
  }
  setLocalPosition(...value) {
    this.position = value;
  }
  setLocalEulerAngles(...value) {
    this.rotation = value;
  }
  setLocalScale(...value) {
    this.scale = value;
  }
  destroy() {
    this.destroyed = true;
  }
}
class IslandRoots {
  constructor(pc, parent) {
    this.parent = parent;
  }
  addChild(child) {
    this.parent.addChild(child);
  }
}
const Painting = new Function("paintingUrl", "royalBedroomUrl", "vestibuleUrl", "IslandObjectRoots", "addAuthoredMeshPhysics", `${source}\nreturn Painting;`)("painting.glb", "royal.glb", "vestibule.glb", IslandRoots, (pc, root, graph) => {
  root.collisionGraph = graph;
});

test("painting uses world placement and compresses depth independently of picture size", () => {
  const model = new Entity();
  const definition = {
    id: "art",
    object: "Painting",
    position: {
      x: 4,
      y: 2,
      z: -3,
    },
    rotation: 90,
    width: 2,
    height: 3,
  };
  const painting = new Painting({
    pc: { Entity },
    modelLibrary: { instantiate: () => model },
    definition,
  });
  const root = painting.visualRoots[0];
  assert.deepEqual(root.position, [4, 2, -3]);
  assert.deepEqual(root.rotation, [0, 90, 0]);
  assert.deepEqual(model.scale, [2, 3, 0.1]);
  assert.equal(painting.definition, definition);
  painting.destroy();
  assert.equal(painting.entity.destroyed, true);
});

test("painting variants retain authored depth, scale, and matching collision geometry", () => {
  assert.deepEqual(Painting.modelUrls, ["painting.glb", "royal.glb", "vestibule.glb"]);
  for (const [variant, expected] of [["royal-bedroom", "royal.glb"], ["vestibule", "vestibule.glb"]]) {
    const models = [];
    const urls = [];
    const painting = new Painting({
      pc: { Entity },
      modelLibrary: {
        instantiate: (url) => {
          urls.push(url);
          const model = new Entity(); models.push(model);

          return model;
        },
      },
      definition: {
        id: "variant",
        variant,
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
        scale: 2,
        stretch: {
          x: 1.5,
          y: 0.5,
          z: 1,
        },
      },
    });
    assert.deepEqual(urls, [expected, expected]);
    assert.deepEqual(models.map(model => model.scale), [[3, 1, 2], [3, 1, 2]]);
    assert.equal(painting.visualRoots[0].collisionGraph, models[1]);
    painting.destroy();
    assert.ok(models[1].destroyed);
  }
});
