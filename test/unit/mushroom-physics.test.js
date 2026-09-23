import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MushroomPhysics } from "../../src/game/objects/ground-cover/MushroomPhysics.js";

class FakeVec3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeEntity {
  children = [];
  components = new Map();
  enabled = true;
  position = null;
  tags = {
    values: new Set(),
    add: (...values) => values.forEach((value) => this.tags.values.add(value)),
    has: (value) => this.tags.values.has(value),
  };

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "rigidbody") {
      this.rigidbody = { ...options };
    }
  }

  setLocalPosition(x, y, z) {
    this.position = { x, y, z };
  }

  setPosition(x, y, z) {
    this.setLocalPosition(x, y, z);
  }

  destroy() {}
}

const pc = {
  BODYGROUP_USER_5: 2048,
  BODYGROUP_USER_6: 4096,
  BODYTYPE_KINEMATIC: "kinematic",
  Entity: FakeEntity,
  Vec3: FakeVec3,
};

function createSubject() {
  const raycasts = [];
  let raycastHits = [];
  const physics = new MushroomPhysics({
    pc,
    app: {
      systems: {
        rigidbody: {
          raycastAll(start, end, options) {
            raycasts.push({ start, end, options });
            return raycastHits;
          },
        },
      },
    },
  });
  return {
    physics,
    raycasts,
    setRaycastHits(hits) {
      raycastHits = hits;
    },
  };
}

function createMushroom(physics, onDestroy = () => {}) {
  return physics.addMushroom({
    variant: "red-mushroom",
    position: { x: 2, y: 3, z: 4 },
    interactionRadius: 0.22,
    scale: 0.82,
    onDestroy,
  });
}

describe("mushroom physics", () => {
  it("uses isolated kinematic feet to push debris without moving the hero", () => {
    const { physics } = createSubject();
    const feet = physics.entity.children;

    assert.equal(feet.length, 2);
    for (const foot of feet) {
      assert.deepEqual(foot.components.get("collision"), {
        type: "sphere",
        radius: 0.17,
      });
      assert.deepEqual(foot.rigidbody, {
        type: "kinematic",
        friction: 0.22,
        restitution: 0,
        group: 4096,
        mask: 2048,
      });
      assert.equal(foot.tags.has("hero-surface-ignore"), true);
    }
  });

  it("creates a non-blocking physics trigger for each mushroom", () => {
    const { physics } = createSubject();
    const mushroom = createMushroom(physics);
    const body = mushroom.entity;
    const collision = body.components.get("collision");

    assert.equal(body.rigidbody, undefined);
    assert.equal(body.tags.has("hero-surface-ignore"), true);
    assert.equal(collision.type, "cylinder");
    assert.equal(collision.axis, 1);
    assert.ok(Math.abs(collision.radius - 0.1804) < 1e-12);
    assert.ok(Math.abs(collision.height - 0.0984) < 1e-12);
  });

  it("destroys a mushroom once when a physics foot ray hits it", () => {
    const { physics, raycasts, setRaycastHits } = createSubject();
    let destructionCount = 0;
    let impact = null;
    const mushroom = createMushroom(physics, (value) => {
      destructionCount += 1;
      impact = value;
    });
    setRaycastHits([{ entity: mushroom.entity }]);

    physics.updateHeroPosition(
      { x: 1, y: 2, z: 3 },
      { direction: { x: 0, z: 1 }, speed: 0.5 },
    );
    physics.updateHeroPosition(
      { x: 1, y: 2, z: 3 },
      { direction: { x: 0, z: 1 }, speed: 0.5 },
    );

    assert.deepEqual(raycasts[0].start, new FakeVec3(0.87, 2.2, 3.1));
    assert.deepEqual(raycasts[0].end, new FakeVec3(0.87, 1.98, 3.1));
    assert.deepEqual(raycasts[1].start, new FakeVec3(1.13, 2.2, 3.1));
    assert.equal(raycasts[0].options.filterCallback(mushroom.entity), true);
    assert.equal(mushroom.entity.enabled, false);
    assert.equal(destructionCount, 1);
    assert.deepEqual(impact, { directionX: 0, directionZ: 1 });
  });

  it("requires only a gentle walking speed to crush a mushroom", () => {
    const { physics, raycasts, setRaycastHits } = createSubject();
    let destructionCount = 0;
    const mushroom = createMushroom(physics, () => {
      destructionCount += 1;
    });
    setRaycastHits([{ entity: mushroom.entity }]);

    physics.updateHeroPosition(
      { x: 2, y: 3, z: 4 },
      { direction: { x: 1, z: 0 }, speed: 0.2 },
    );

    assert.equal(raycasts.length, 0);
    assert.deepEqual(physics.entity.children[0].position, {
      x: 2.1,
      y: 3.16,
      z: 4.13,
    });
    assert.equal(mushroom.entity.enabled, true);
    assert.equal(destructionCount, 0);

    physics.updateHeroPosition(
      { x: 2, y: 3, z: 4 },
      { direction: { x: 1, z: 0 }, speed: 0.5 },
    );

    assert.equal(raycasts.length, 2);
    assert.equal(mushroom.entity.enabled, false);
    assert.equal(destructionCount, 1);
  });

  it("disables a collected mushroom before a foot ray can destroy it", () => {
    const { physics, setRaycastHits } = createSubject();
    let destroyed = false;
    const mushroom = createMushroom(physics, () => {
      destroyed = true;
    });
    setRaycastHits([{ entity: mushroom.entity }]);

    physics.hide(mushroom);
    physics.updateHeroPosition({ x: 2, y: 3, z: 4 }, { speed: 0.5 });

    assert.equal(mushroom.entity.enabled, false);
    assert.equal(destroyed, false);
  });
});
