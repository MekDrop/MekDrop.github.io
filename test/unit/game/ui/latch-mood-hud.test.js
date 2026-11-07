import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec2, Vec3, Vec4 } from "playcanvas";
import { LatchMoodHud } from "../../../../src/game/ui/LatchMoodHud.js";

class Entity {
  children = [];
  addComponent(type, options) {
    this[type] = {
      ...options,
      scale: 1,
      syncDrawOrder: () => {},
    };
  }
  addChild(child) {
    this.children.push(child);
  }
  setLocalPosition(...position) {
    this.position = position;
  }
  setLocalScale(...scale) {
    this.scale = scale;
  }
  setLocalEulerAngles() {}
  destroy() {}
}

class TestSlimeHud extends LatchMoodHud {
  createDrawnTexture(name) {
    return { name };
  }
}

it("affection and annoyance render together, grow independently, and hide separately", () => {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const owner = {
      pc: {
        Entity,
        Vec2,
        Vec3,
        Vec4,
      },
      app: {
        root: new Entity(),
        graphicsDevice: {
          canvas: {
            width: 640,
            clientWidth: 640,
            clientHeight: 480,
          },
        },
      },
      alive: true,
      position: new Vec3(),
      gatewayArrival: { active: false },
      affection: {
        charge: 0,
        happyRemaining: 0,
      },
      annoyance: {
        level: 0,
        active: false,
      },
      statuses: new Map(),
      runtime: {
        camera: {
          component: { worldToScreen: () => new Vec3(320, 150, 0) },
          entity: {
            getPosition: () => new Vec3(0, 0, 5),
            forward: new Vec3(0, 0, -1),
          },
        },
      },
    };
    const affectionHud = new TestSlimeHud(owner);
    const annoyanceHud = new TestSlimeHud(owner, "agitated");
    const heart = affectionHud.entity.children[0];
    const annoyance = annoyanceHud.entity.children[0];
    const update = () => {
      affectionHud.update(0.1); annoyanceHud.update(0.1);
    };
    update();
    assert.equal(heart.enabled, false);
    assert.equal(annoyance.enabled, false);
    owner.affection.charge = 3;
    update();
    assert.equal(heart.element.texture.name, "Hero mood happy");
    assert.equal(heart.position[0], 320);
    owner.annoyance.level = 1;
    update();
    assert.equal(heart.enabled, true);
    assert.equal(annoyance.enabled, true);
    assert.equal(annoyance.element.texture.name, "Hero mood agitated");
    assert.equal(heart.position[0], 290);
    assert.equal(annoyance.position[0], 350);
    const heartScale = heart.scale[0], firstScale = annoyance.scale[0];
    owner.affection.charge = 0.6;
    owner.annoyance.level = 4;
    update();
    assert.ok(heart.scale[0] < heartScale);
    assert.ok(annoyance.scale[0] > firstScale);
    owner.annoyance.level = 5;
    owner.annoyance.active = true;
    update();
    assert.equal(heart.enabled, true);
    assert.equal(heart.element.texture.name, "Hero mood happy");
    assert.equal(annoyance.element.texture.name, "Hero mood angry");
    owner.affection.charge = 0;
    update();
    assert.equal(heart.enabled, false);
    assert.equal(annoyance.enabled, true);
    assert.equal(annoyance.position[0], 320);
    owner.alive = false;
    update();
    assert.equal(heart.enabled, false);
    assert.equal(annoyance.enabled, false);
    owner.alive = true;
    owner.affection.charge = 1;
    owner.gatewayArrival.active = true;
    update();
    assert.equal(heart.enabled, false);
    assert.equal(annoyance.enabled, false);
    affectionHud.destroy();
    annoyanceHud.destroy();
  } finally {
    globalThis.matchMedia = originalMatchMedia;
  }
});
