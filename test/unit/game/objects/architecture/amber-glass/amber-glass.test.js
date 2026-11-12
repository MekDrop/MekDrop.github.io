import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { AmberGlass } from "../../../../../../src/game/objects/architecture/amber-glass/AmberGlass.js";

test("authored window gradient spans all rows and borrows source textures", () => {
  const source = new pc.StandardMaterial();
  source.name = "Semitransparent amber glazing pane 0 0";
  source.emissive.set(0.65, 0.65, 0.65);
  const diffuseMap = { name: "frosting" };
  const emissiveMap = { name: "warmth" };
  source.diffuseMap = diffuseMap;
  source.emissiveMap = emissiveMap;
  for (const rows of [2, 3, 5]) {
    const instances = Array.from({ length: rows }, (_, row) => ({
      node: new pc.GraphNode(`Amber glass pane 0 ${row}`),
      material: source,
    }));
    const visual = new pc.EventHandler();
    visual.findComponents = () => [{ meshInstances: instances }];
    AmberGlass.add(pc, visual, {
      authored: true,
      paneRows: rows,
      opacity: 0.92,
      cull: pc.CULLFACE_BACK,
    });
    for (let row = 0; row < rows; row++) {
      const material = instances[row].material;
      assert.notEqual(material, source);
      assert.equal(material.diffuseMap, diffuseMap);
      assert.equal(material.emissiveMap, emissiveMap);
      assert.equal(material.diffuseMapTiling.y, 1 / rows);
      assert.equal(material.emissiveMapOffset.y, row / rows);
      assert.equal(material.emissive.r, 0.65);
      if (row > 0) {
        const previous = instances[row - 1].material;
        assert.ok(Math.abs(previous.diffuseMapOffset.y + previous.diffuseMapTiling.y - material.diffuseMapOffset.y) < 1e-6);
      }
    }
    visual.fire("destroy");
  }
  assert.equal(source.diffuseMapTiling.y, 1);
  assert.equal(source.emissiveMapOffset.y, 0);
  source.destroy();
});

test("lantern glass retains its amber treatment without the window gradient", () => {
  const source = new pc.StandardMaterial();
  source.name = "Warm luminous amber glass";
  const instance = { material: source };
  const visual = new pc.EventHandler();
  visual.findComponents = () => [{ meshInstances: [instance] }];
  AmberGlass.add(pc, visual);
  assert.equal(instance.material.opacity, 0.72);
  assert.equal(instance.material.cull, pc.CULLFACE_NONE);
  assert.equal(instance.material.diffuse.r, 0.95);
  assert.equal(instance.material.diffuseMapTiling.y, 1);
  assert.equal(instance.material.emissive.r, 0);
  visual.fire("destroy");
  source.destroy();
});
