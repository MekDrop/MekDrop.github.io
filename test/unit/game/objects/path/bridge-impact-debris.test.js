import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../src/game/objects/path/BridgeImpactDebris.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('import { BridgeImpactResources } from "./BridgeImpactResources.js";', `
    class BridgeImpactResources {
      static acquire({pc,materials,modelLibrary,material}) {
        const sample=modelLibrary.instantiate("original-rail");const wood=sample.findComponents("render")[0].meshInstances[0].material;sample.destroy();
        const prepare=source=>{const clone=source.clone();clone.sourceMaterial=source;clone.blendType=pc.BLEND_NORMAL;clone.depthWrite=false;return clone;};
        const paving=[prepare(materials.get("path")),prepare(materials.get(material))],timber=[prepare(wood)];
        const create=(root,size,prototypes,isPaving)=>{root.testPaving=isPaving;const visual=new pc.Entity("Shared chip visual");visual.setLocalScale(size);const instances=prototypes.map(mat=>{const instance={material:mat,parameters:new Map(),setParameter:(name,value)=>instance.parameters.set(name,value)};instance.setParameter("material_opacity",1);return instance;});visual.addComponent("render",{meshInstances:instances});root.addChild(visual);return instances;};
        return {warmShaders:()=>{},createPaving:(root,size)=>create(root,size,paving,true),createTimber:(root,size)=>create(root,size,timber,false),release:()=>{for(const mat of [...paving,...timber])mat.destroy();}};
      }
    }
  `);
const { BridgeImpactDebris } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

class ComponentEntity extends pc.Entity {
  /**
   * @param {string} name
   * @param {Record<string,number|string|pc.Material>} options
   */
  addComponent(name, options) {
    this[name] = name === "render" ? {
      ...options,
      meshInstances: options.meshInstances ?? [{ material: options.material }],
    } : options;
  }

  /**
   * @param {string} name
   */
  findComponents(name) {
    const components = this[name] ? [this[name]] : [];
    for (const child of this.children) {
      components.push(...child.findComponents(name));
    }

    return components;
  }

  destroy() {
    this.disposed = true;
    super.destroy();
  }
}

/**
 * @param {number} station
 * @param {boolean} horizontal
 */
function fixture(station = 3, horizontal = true) {
  const path = new pc.StandardMaterial();
  const timber = new pc.StandardMaterial();
  const railing = new pc.StandardMaterial();
  path.name = "Actual path surface";
  timber.name = "Actual bridge fascia";
  railing.name = "Original authored railing wood";
  railing.diffuse.set(0.25, 0.12, 0.05);
  const root = new ComponentEntity("Rubble test root");
  const impact = {
    position: new pc.Vec3(5, 0.2, -3),
    rotation: new pc.Quat().setFromEulerAngles(58, 20, 42),
    velocity: new pc.Vec3(1, -4, -0.5),
    contactPoint: new pc.Vec3(5, 0, -3),
  };
  const debris = new BridgeImpactDebris({
    pc: {
      ...pc,
      Entity: ComponentEntity,
    },
    app: { root },
    materials: new Map([["path", path], ["timber", timber]]),
    modelLibrary: {
      instantiate: () => {
        const entity = new ComponentEntity("Original railing material sample");
        entity.addComponent("render", { material: railing });

        return entity;
      },
    },
    definition: {
      material: "timber",
      span: { horizontal },
    },
    impact,
    station,
  });

  return {
    debris,
    path,
    timber,
    railing,
    root,
    dispose: () => {
      debris.destroy();
      root.destroy();
      path.destroy();
      timber.destroy();
      railing.destroy();
    },
  };
}

it("releases ten small original-material pieces with bounded engine velocities and static-only contacts", () => {
  for (const horizontal of [false, true]) {
    const context = fixture(3, horizontal);
    const pieces = context.debris.entity.children;
    assert.equal(pieces.length, 10);
    assert.equal(pieces.filter((piece) => piece.testPaving).length, 0);
    assert.equal(pieces.filter((piece) => !piece.testPaving).length, 10);
    for (const piece of pieces) {
      assert.equal(piece.rigidbody.type, "dynamic");
      assert.equal(piece.rigidbody.mask, pc.BODYMASK_STATIC);
      assert.equal(piece.rigidbody.group, pc.BODYGROUP_USER_2);
      assert.deepEqual(piece.getLocalScale(), pc.Vec3.ONE);
      assert.ok(piece.rigidbody.linearVelocity.y >= 0.9 && piece.rigidbody.linearVelocity.y <= 1.8);
      assert.ok(Math.hypot(piece.rigidbody.linearVelocity.x, piece.rigidbody.linearVelocity.z) < 2);
      const half = piece.collision.halfExtents;
      const rotation = piece.getRotation();
      const extent = Math.abs(rotation.transformVector(new pc.Vec3(half.x, 0, 0)).y) +
        Math.abs(rotation.transformVector(new pc.Vec3(0, half.y, 0)).y) +
        Math.abs(rotation.transformVector(new pc.Vec3(0, 0, half.z)).y);
      assert.ok(piece.getPosition().y - extent >= 0.02499);
      assert.equal(piece.findComponents("render")[0].meshInstances[0].material.sourceMaterial, context.railing);
    }
    context.dispose();
  }
});

it("fades pieces after their bounce, preserves shared materials, and disposes GPU owners", () => {
  const context = fixture();
  const pieces = [...context.debris.entity.children];
  context.debris.update(0.1);
  assert.equal(context.debris.expired, false);
  context.debris.update(1.5);
  for (const piece of pieces) {
    for (const render of piece.findComponents("render")) {
      for (const instance of render.meshInstances) {
        assert.notEqual(instance.material, context.path);
        assert.notEqual(instance.material, context.timber);
        assert.notEqual(instance.material, context.railing);
        const opacity = instance.parameters.get("material_opacity");
        assert.ok(opacity < 1 && opacity > 0);
        assert.equal(instance.material.opacity, 1);
        assert.equal(instance.material.depthWrite, false);
      }
    }
  }
  assert.equal(context.path.opacity, 1);
  assert.equal(context.timber.opacity, 1);
  assert.equal(context.railing.opacity, 1);
  context.debris.update(1);
  assert.equal(context.debris.expired, true);
  assert.ok(pieces.every((piece) => !piece.enabled));
  context.debris.destroy();
  for (const piece of pieces) {
    assert.equal(piece.disposed, true);
  }
  context.dispose();
});

it("varies sizes between stations while keeping the same impact repeatable", () => {
  const first = fixture(3);
  const repeat = fixture(3);
  const next = fixture(4);
  const firstPiece = first.debris.entity.children[0];
  const repeated = repeat.debris.entity.children[0];
  const different = next.debris.entity.children[0];
  assert.deepEqual(firstPiece.collision.halfExtents, repeated.collision.halfExtents);
  assert.deepEqual(firstPiece.rigidbody.angularVelocity, repeated.rigidbody.angularVelocity);
  assert.notDeepEqual(firstPiece.collision.halfExtents, different.collision.halfExtents);
  first.dispose();
  repeat.dispose();
  next.dispose();
});
