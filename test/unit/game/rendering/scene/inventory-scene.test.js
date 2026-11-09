import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec3 } from "playcanvas";

// Load the complete owner with only its browser/asset dependencies substituted.
const source = readFileSync(new URL("../../../../../src/game/rendering/scene/InventoryScene.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replace("export class InventoryScene", "class InventoryScene");
class Hud {
  attach() {}
  setInventory() {}
  destroy() {}
}
const constructed = [];
class ThrownItem {
  constructor(options) {
    constructed.push(this);
    this.options = options;
    this.entity = {};
  }
  destroy() {
    this.destroyed = true;
  }
}
const InventoryScene = new Function("Hero", "ThrownInventoryItem", "InventoryHud", `${source}\nreturn InventoryScene;`)({}, ThrownItem, Hud);

function fixture({ hits = [], ray = {
  start: new Vec3(0, 10, 0),
  end: new Vec3(8, -10, 6),
} } = {}) {
  const rays = [];
  const raycasts = [];
  const hero = {
    position: new Vec3(1, 0, 1),
    facingDirection: {
      x: 0,
      z: -1,
    },
  };
  let camera = {
    camera: { worldToScreen: () => ({ y: 200 }) },
    baseOrthoHeight: 10,
    zoom: 1,
  };
  const store = {
    inventory: {
      visible: true,
      items: [{
        slot: 0,
        modelUrl: "flower.glb",
      }],
    },
    dropInventoryItem: () => "flower",
  };
  const scene = new InventoryScene({
    pc: { Vec3 },
    app: {
      systems: {
        rigidbody: {
          raycastAll: (...args) => {
            raycasts.push(args);

            return hits;
          },
        },
      },
    },
    modelLibrary: {},
    heroConfigurationStore: store,
    translate: (key) => key,
    getHero: () => hero,
    getMapRoot: () => ({ addChild: () => {} }),
    canvas: {
      clientHeight: 100,
      getBoundingClientRect: () => ({ top: 20 }),
    },
    pointerRay: (event) => {
      rays.push(event);

      return ray;
    },
    getCamera: () => camera,
    cameraPitch: Math.atan(1 / Math.sqrt(2)),
  });

  return {
    scene,
    hero,
    store,
    rays,
    raycasts,
    setCamera: (value) => {
      camera = value;
    },
  };
}

it("uses the first upward-facing sorted physics hit and independent height pointer", () => {
  const point = new Vec3(5, 2, 7);
  const f = fixture({
    hits: [
      {
        normal: { y: 0.34 },
        point: new Vec3(99, 99, 99),
      },
      {
        normal: { y: 0.35 },
        point,
      },
      {
        normal: { y: 1 },
        point: new Vec3(9, 9, 9),
      },
    ],
  });
  assert.equal(f.scene.dropItem(0, 30, 40, 50, 60), "flower");
  const item = constructed.at(-1).options;
  assert.deepEqual(item.position, point);
  assert.notEqual(item.position, point);
  assert.deepEqual(item.direction, {
    x: 4,
    z: 6,
  });
  assert.deepEqual(f.rays, [{
    clientX: 30,
    clientY: 40,
  }, {
    clientX: 50,
    clientY: 60,
  }]);
  assert.deepEqual(f.raycasts[0][2], { sort: true });
  assert.equal(item.dropStartY, 14);
});

it("falls back to the hero-height plane when no surface is hit", () => {
  const f = fixture();
  f.scene.dropItem(0, 30, 240);
  const item = constructed.at(-1).options;
  assert.deepEqual(item.position, new Vec3(4, 0, 3));
  assert.deepEqual(item.direction, {
    x: 3,
    z: 2,
  });
  assert.equal(item.dropStartY, null);
  assert.deepEqual(f.rays[0], f.rays[1]);
});

it("keeps hero placement when rays are unavailable, parallel or outside the segment", () => {
  for (const ray of [null, {
    start: new Vec3(0, 1, 0),
    end: new Vec3(1, 1, 1),
  },
  {
    start: new Vec3(0, 1, 0),
    end: new Vec3(1, 2, 1),
  }]) {
    const f = fixture({ ray });
    f.scene.dropItem(0, 30, 40);
    const item = constructed.at(-1).options;
    assert.equal(item.position, f.hero.position);
    assert.equal(item.direction, f.hero.facingDirection);
    assert.equal(item.dropStartY, null);
  }
});

it("keeps the hero facing when dropped directly above the hero", () => {
  const f = fixture({
    hits: [{
      normal: { y: 1 },
      point: new Vec3(1, 2, 1),
    }],
  });
  f.scene.dropItem(0, 30, 240);
  assert.equal(constructed.at(-1).options.direction, f.hero.facingDirection);
});

it("resolves the live camera and preserves minimum, maximum and zoom-scaled fall heights", () => {
  const f = fixture();
  const drop = (y) => {
    f.scene.dropItem(0, 30, y);

    return constructed.at(-1).options.dropStartY;
  };
  assert.equal(drop(219.9), 0.35);
  assert.equal(drop(0), 12);
  f.setCamera({
    camera: { worldToScreen: () => ({ y: 200 }) },
    baseOrthoHeight: 10,
    zoom: 2,
  });
  assert.ok(Math.abs(drop(200) - 2 / Math.cos(Math.atan(1 / Math.sqrt(2)))) < 1e-12);
  f.setCamera(null);
  assert.equal(drop(200), null);
});

it("does not consume inventory or construct items without a droppable model", () => {
  const f = fixture();
  f.store.inventory.items = [];
  const count = constructed.length;
  assert.equal(f.scene.dropItem(0, 30, 40), null);
  assert.equal(constructed.length, count);
  assert.equal(f.rays.length, 0);
});

it("disposes thrown items and clears them for map replacement and destruction", () => {
  const f = fixture();
  f.scene.dropItem(0, 30, 40);
  const first = constructed.at(-1);
  f.scene.clearWorldItems();
  assert.equal(first.destroyed, true);
  assert.equal(f.scene.thrownItemCount, 0);
  f.scene.dropItem(0, 30, 40);
  const second = constructed.at(-1);
  f.scene.destroy();
  assert.equal(second.destroyed, true);
  assert.equal(f.scene.thrownItemCount, 0);
});
