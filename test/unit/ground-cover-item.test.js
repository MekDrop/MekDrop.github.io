import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCoverItem } from "../../src/game/objects/ground-cover/GroundCoverItem.js";

class FakeVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  normalize() {
    const length = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return this;
  }
}

class FakeMat4 {
  copy() {
    return this;
  }

  invert() {
    return this;
  }

  transpose() {
    return this;
  }

  mul2() {
    return this;
  }

  transformPoint(source, target) {
    return target.set(source.x, source.y, source.z);
  }

  transformVector(source, target) {
    return target.set(source.x, source.y, source.z);
  }
}

class FakeMesh {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
  }

  setPositions(positions) {
    this.positions = positions;
  }

  setNormals(normals) {
    this.normals = normals;
  }

  setUvs(_channel, uvs) {
    this.uvs = uvs;
  }

  update() {
    this.updated = true;
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeMeshInstance {
  constructor(mesh, material, node) {
    this.mesh = mesh;
    this.material = material;
    this.node = node;
  }
}

class FakeMaterial {
  constructor(name) {
    this.name = name;
    this.opacity = 1;
  }

  clone() {
    return new FakeMaterial(this.name);
  }

  update() {
    this.updated = true;
  }

  destroy() {
    this.destroyed = true;
  }
}

function createSourceMesh(yOffset) {
  const positions = [
    -0.1,
    yOffset,
    -0.1,
    0,
    yOffset,
    -0.1,
    -0.05,
    yOffset + 0.08,
    0,
    0,
    yOffset,
    -0.1,
    0.1,
    yOffset,
    -0.1,
    0.05,
    yOffset + 0.08,
    0,
    -0.1,
    yOffset,
    0.1,
    0,
    yOffset,
    0.1,
    -0.05,
    yOffset + 0.08,
    0,
    0,
    yOffset,
    0.1,
    0.1,
    yOffset,
    0.1,
    0.05,
    yOffset + 0.08,
    0,
  ];
  const normals = Array.from({ length: positions.length / 3 }, () => [
    0, 1, 0,
  ]).flat();
  const uvs = Array.from({ length: positions.length / 3 }, () => [0, 0]).flat();
  const indices = Array.from(
    { length: positions.length / 3 },
    (_, index) => index,
  );
  return {
    primitive: [
      { indexed: true, base: 0, count: indices.length, baseVertex: 0 },
    ],
    getPositions(target) {
      target.push(...positions);
      return positions.length / 3;
    },
    getNormals(target) {
      target.push(...normals);
    },
    getUvs(_channel, target) {
      target.push(...uvs);
    },
    getIndices(target) {
      target.push(...indices);
    },
  };
}

function createSubject(ambientMotion) {
  const generatedMeshes = [];

  class Mesh extends FakeMesh {
    constructor() {
      super();
      generatedMeshes.push(this);
    }
  }

  class Entity {
    enabled = true;
    angles = [0, 0, 0];
    children = [];
    components = new Map();
    position = null;
    scale = null;
    tags = {
      values: new Set(),
      add: (...values) =>
        values.forEach((value) => this.tags.values.add(value)),
      has: (value) => this.tags.values.has(value),
    };

    constructor(name = "Entity") {
      this.name = name;
    }

    setLocalPosition(x, y, z) {
      this.position = { x, y, z };
    }

    setLocalEulerAngles(...angles) {
      this.angles = angles;
    }

    setLocalScale(...scale) {
      this.scale = scale;
    }

    getLocalPosition() {
      return this.position ?? { x: 0, y: 0, z: 0 };
    }

    getPosition() {
      return this.getLocalPosition();
    }

    getRotation() {
      return {};
    }

    getWorldTransform() {
      return new FakeMat4();
    }

    addChild(child) {
      this.children.push(child);
      child.parent = this;
    }

    addComponent(type, options) {
      this.components.set(type, options);
      if (type === "render") {
        this.render = options;
      }
      if (type === "collision") {
        this.collision = options;
      }
      if (type === "rigidbody") {
        const listeners = new Map();
        this.rigidbody = {
          enabled: true,
          ...options,
          activateCount: 0,
          teleportCount: 0,
          activate() {
            this.activateCount += 1;
          },
          teleport() {
            this.teleportCount += 1;
          },
          on(event, handler) {
            listeners.set(event, handler);
          },
          off(event, handler) {
            if (listeners.get(event) === handler) {
              listeners.delete(event);
            }
          },
          fire(event, value) {
            listeners.get(event)?.(value);
          },
        };
      }
    }

    removeComponent(type) {
      this.components.delete(type);
      delete this[type];
    }

    destroy() {
      this.destroyed = true;
    }
  }

  const materials = [new FakeMaterial("cap"), new FakeMaterial("stalk")];
  const modelLibrary = {
    instantiateMerged: () => new Entity("Merged ground cover"),
    instantiate() {
      const root = new Entity("Mushroom model");
      [0.12, 0].forEach((yOffset, index) => {
        const part = new Entity(index ? "Stalk" : "Cap");
        part.render = {
          meshInstances: [
            {
              mesh: createSourceMesh(yOffset),
              material: materials[index],
              node: part,
            },
          ],
        };
        root.addChild(part);
      });
      return root;
    },
  };

  const item = new GroundCoverItem({
    pc: {
      BLEND_NORMAL: "normal",
      BODYGROUP_STATIC: 2,
      BODYGROUP_USER_5: 2048,
      BODYGROUP_USER_6: 4096,
      BODYTYPE_DYNAMIC: "dynamic",
      BODYTYPE_STATIC: "static",
      Entity,
      Mat4: FakeMat4,
      Mesh,
      MeshInstance: FakeMeshInstance,
      Vec3: FakeVec3,
    },
    app: { graphicsDevice: {} },
    modelLibrary,
    modelUrl: "ground-cover.glb",
    variant: "test-ground-cover",
    x: 0,
    y: 0,
    z: 0,
    rotation: 25,
    scale: 1,
    flexibility: 0.4,
    stepReaction: "none",
    phase: 1.3,
    ambientMotion,
  });
  return { generatedMeshes, item, materials, model: item.entity.children[0] };
}

describe("ground cover item ambient motion", () => {
  it("keeps mushrooms still at fitted zoom strength", () => {
    const { item } = createSubject(0);

    for (let frame = 0; frame < 600; frame += 1) {
      item.advance(1 / 60);
      assert.deepEqual(item.entity.angles, [0, 0, 0]);
    }
  });

  it("retains mushroom sway at closer zoom strength", () => {
    const { item } = createSubject(1);

    item.advance(1 / 60);

    assert.notDeepEqual(item.entity.angles, [0, 0, 0]);
  });

  it("removes ambient tilt immediately when motion is disabled", () => {
    const { item } = createSubject(1);
    item.advance(1 / 60);

    item.ambientMotion = 0;

    assert.deepEqual(item.entity.angles, [0, 0, 0]);
  });

  it("splits both mushroom meshes into fading lightweight physics shards", () => {
    const { generatedMeshes, item, materials, model } = createSubject(0);

    item.crush({ directionX: 3, directionZ: 4 });

    assert.equal(item.entity.enabled, true);
    assert.equal(model.enabled, true);
    item.advance(0.12);
    assert.equal(model.enabled, true);
    assert.ok(item.entity.scale[1] < 1);
    assert.notDeepEqual(item.entity.angles, [0, 0, 0]);
    item.advance(0.12);
    item.advance(0.12);
    assert.equal(model.enabled, false);

    const debris = item.entity.children[1];
    const fragments = debris.children.filter(
      (child) => child.rigidbody?.type === "dynamic",
    );
    assert.equal(fragments.length, 4);
    assert.equal(generatedMeshes.length, 4);
    assert.equal(
      generatedMeshes.reduce(
        (count, mesh) => count + mesh.positions.length / 9,
        0,
      ),
      8,
    );
    const shardMaterials = new Set(
      fragments.map((fragment) => fragment.render.meshInstances[0].material),
    );
    assert.equal(shardMaterials.size, 2);
    assert.equal(
      [...shardMaterials].every((material) => !materials.includes(material)),
      true,
    );

    const velocities = new Set();
    for (const fragment of fragments) {
      assert.equal(fragment.components.get("collision").type, "sphere");
      assert.equal(fragment.rigidbody.type, "dynamic");
      assert.equal(fragment.rigidbody.group, 2048);
      assert.equal(fragment.rigidbody.mask, 4098);
      assert.equal(fragment.tags.has("hero-surface-ignore"), true);
      assert.equal(fragment.rigidbody.activateCount, 1);
      assert.ok(fragment.rigidbody.linearVelocity.y > 0);
      velocities.add(
        [
          fragment.rigidbody.linearVelocity.x,
          fragment.rigidbody.linearVelocity.y,
          fragment.rigidbody.linearVelocity.z,
        ].join(":"),
      );
    }
    assert.equal(velocities.size, 4);

    const initialPositions = fragments.map((fragment) => ({
      ...fragment.position,
    }));
    fragments.forEach((fragment, index) => {
      fragment.position = {
        x: initialPositions[index].x + 1,
        y: initialPositions[index].y - 1,
        z: initialPositions[index].z + 1,
      };
    });
    item.advance(0.1);
    assert.equal(
      fragments.every((fragment, index) => {
        const initial = initialPositions[index];
        return (
          Math.hypot(
            fragment.position.x - initial.x,
            fragment.position.z - initial.z,
          ) <=
            0.15 + Number.EPSILON && fragment.rigidbody.teleportCount === 1
        );
      }),
      true,
    );
    const constrainedPositions = fragments.map((fragment) => ({
      ...fragment.position,
    }));
    const terrain = {
      tags: { has: (tag) => tag === "terrain-physics-surface" },
    };
    fragments[0].rigidbody.fire("collisionstart", {
      other: terrain,
      contacts: [{ normal: { y: 0 } }],
    });
    item.advance(0.1);
    assert.equal(fragments[0].rigidbody.type, "dynamic");
    for (const fragment of fragments) {
      fragment.rigidbody.fire("collisionstart", {
        other: terrain,
        contacts: [{ normal: { y: 1 } }],
      });
    }
    item.advance(0.1);
    assert.equal(item.entity.enabled, true);
    assert.equal(model.enabled, false);
    assert.equal(
      fragments.every(
        (fragment) =>
          fragment.rigidbody?.type === "dynamic" && fragment.collision,
      ),
      true,
    );
    assert.equal(item.grassImpressionContacts.length, 4);
    assert.equal(
      item.grassImpressionContacts.every(
        (contact) => contact.strength === 0.22 && contact.radius >= 0.025,
      ),
      true,
    );
    assert.deepEqual(
      fragments.map((fragment) => fragment.position),
      constrainedPositions,
    );

    item.advance(4);
    assert.equal(
      fragments.every(
        (fragment) =>
          fragment.rigidbody === undefined && fragment.collision === undefined,
      ),
      true,
    );
    assert.equal(item.grassImpressionContacts.length, 0);
    assert.equal(
      [...shardMaterials].every(
        (material) =>
          material.blendType === "normal" &&
          material.depthWrite === false &&
          material.opacity > 0 &&
          material.opacity < 1,
      ),
      true,
    );

    item.advance(2);
    assert.equal(item.entity.enabled, false);
    assert.equal(
      [...shardMaterials].every((material) => material.destroyed),
      true,
    );

    item.destroy();
    assert.equal(
      generatedMeshes.every((mesh) => mesh.destroyed),
      true,
    );
  });
});
