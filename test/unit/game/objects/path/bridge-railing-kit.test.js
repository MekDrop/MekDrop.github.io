import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../src/game/objects/path/BridgeRailingKit.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace(/import (\w+) from "[^"]+\.glb\?url";/g, 'const $1 = "$1";')
  .replace(/from "(\.\.?\/[^\"]+)"/g, (_match, path) => `from "${new URL(path, sourceUrl).href}"`);
const kitUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { BridgeRailingKit } = await import(kitUrl);
const ownerSource = readFileSync(new URL("BridgeRailing.js", sourceUrl), "utf8").replace("./BridgeRailingKit.js", kitUrl);
const { BridgeRailing } = await import(`data:text/javascript;base64,${Buffer.from(ownerSource).toString("base64")}`);

/**
 * @returns {{kit: BridgeRailingKit, batches: Array, timber: object}}
 */
function fixture() {
  const batches = [];
  const released = [];
  const timber = new pc.StandardMaterial();
  timber.name = "Shared timber";
  const modelLibrary = {
    instantiate: () => ({
      findComponents: () => [{ meshInstances: [{ material: timber }] }],
      destroy: () => {},
    }),
    instantiateMergedBatch: (url, matrices, options) => {
      batches.push({
        url,
        matrices,
        options,
      });

      return {
        entity: new pc.Entity(options.name),
        vertexBuffer: { destroy: () => released.push(url) },
      };
    },
  };

  return {
    kit: new BridgeRailingKit({
      pc,
      modelLibrary,
      root: new pc.Entity(),
    }),
    batches,
    timber,
    modelLibrary,
    released,
  };
}

/**
 * @param {number[]} values
 * @returns {pc.Mat4[]}
 */
function matrices(values) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += 16) {
    const matrix = new pc.Mat4();
    matrix.data.set(values.slice(offset, offset + 16));
    result.push(matrix);
  }

  return result;
}

for (const direction of [new pc.Vec3(3, 0, 4), new pc.Vec3(-3, 1, -4), new pc.Vec3(1, 1, 0)]) {
  it(`keeps arbitrary railing endpoints and bay connections aligned for ${direction}`, () => {
    const { kit, batches, timber } = fixture();
    const position = new pc.Vec3(3, 2, -4);
    const originalDirection = direction.clone();
    const length = 5.2;
    kit.addRailing({
      position,
      length,
      direction,
      postSpacing: 1,
    });
    kit.build();
    const posts = matrices(batches.find(b => b.options.name.startsWith("Bridge railing posts")).matrices);
    const rails = matrices(batches.find(b => b.options.name.startsWith("Bridge railing segments")).matrices);
    const end = position.clone().add(direction.clone().normalize().mulScalar(length));
    assert.ok(posts[0].getTranslation().distance(position.clone().add(new pc.Vec3(0, 0.17, 0))) < 1e-5);
    assert.ok(posts.at(-1).getTranslation().distance(end.add(new pc.Vec3(0, 0.17, 0))) < 1e-5);
    assert.equal(rails.length, posts.length - 1);
    for (let index = 0; index < rails.length; index += 1) {
      const start = posts[index].getTranslation().add(new pc.Vec3(0, 0.17, 0));
      const finish = posts[index + 1].getTranslation().add(new pc.Vec3(0, 0.17, 0));
      assert.ok(start.distance(finish) <= 1.00001);
      assert.ok(rails[index].transformPoint(new pc.Vec3(0, 0, -0.5)).distance(start) < 0.003);
      assert.ok(rails[index].transformPoint(new pc.Vec3(0, 0, 0.5)).distance(finish) < 0.003);
    }
    assert.deepEqual(direction, originalDirection);
    assert.deepEqual(position, new pc.Vec3(3, 2, -4));
    for (const batch of batches) {
      assert.notEqual(batch.options.material, timber);
      assert.equal(batch.options.material.diffuse.r, 0.72);
    }
  });
}

it("shares the corner post between connected runs and handles short end bays", () => {
  const { kit, batches } = fixture();
  kit.addRailing({
    position: new pc.Vec3(),
    length: 0.3,
    direction: new pc.Vec3(0, 0, 1),
  });
  kit.addRailing({
    position: new pc.Vec3(0, 0, 0.3),
    length: 0.3,
    direction: new pc.Vec3(1, 0, 0),
  });
  kit.build();
  const posts = batches.find(b => b.options.name.startsWith("Bridge railing posts"));
  assert.equal(posts.matrices.length / 16, 3);
});

it("regenerates an existing railing without retaining old entities or instance buffers", () => {
  const { modelLibrary, released, batches } = fixture();
  const definition = {
    id: "test-railing",
    position: {
      x: 1,
      y: 2,
      z: 3,
    },
    length: 6,
    direction: {
      x: 1,
      y: 0,
      z: 0,
    },
  };
  const rail = new BridgeRailing({
    pc,
    modelLibrary,
    definition,
  });
  const originalVisual = rail.entity.children[0];
  rail.regenerate({
    position: {
      x: -2,
      y: 3,
      z: 4,
    },
    length: 2.5,
    direction: {
      x: 0,
      y: 0,
      z: -1,
    },
  });
  assert.equal(released.length, 2);
  assert.equal(rail.entity.children.length, 1);
  assert.equal(originalVisual.parent, null);
  assert.deepEqual(rail.entity.getPosition(), new pc.Vec3(-2, 3, 4));
  assert.equal(definition.length, 2.5);
  assert.deepEqual(definition.direction, {
    x: 0,
    y: 0,
    z: -1,
  });
  const latestPosts = matrices(batches.at(-1).matrices);
  assert.ok(latestPosts.at(-1).getTranslation().distance(new pc.Vec3(0, 0.17, -2.5)) < 1e-5);
  rail.destroy();
  assert.equal(released.length, 4);
});
