import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec3 } from "playcanvas";

const source = readFileSync(new URL("../../../../../src/game/rendering/scene/HeroPatScene.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replace("export class HeroPatScene", "class HeroPatScene");

function fixture() {
  const calls = [];
  let hand;
  let gesture;
  let inventoryVisible = false;
  class Hand {
    static modelUrl = "hand.glb";
    entity = {};
    constructor(options) {
      this.options = options;
      hand = this;
    }
    pat() {
      calls.push("pat");

      return true;
    }
    update(dt) {
      calls.push(["update", dt]);
    }
    destroy() {
      calls.push("hand:destroy");
    }
  }
  class Gesture {
    constructor(canvas, options) {
      gesture = options;
    }
    destroy() {
      calls.push("gesture:destroy");
    }
  }
  const HeroPatScene = new Function("HeroPatHand", "HeroPatGesture", `${source}\nreturn HeroPatScene;`)(Hand, Gesture);
  const hero = {
    canBePatted: true,
    get patPosition() {
      return new Vec3(10, 5, 0);
    },
    pat: () => calls.push("contact"),
  };
  const camera = {
    camera: { worldToScreen: (p) => new Vec3(p.x * 10, p.y * 10, 0) },
    right: new Vec3(1, 0, 0),
    rotation: 2,
    firstPersonEnabled: false,
  };
  const scene = new HeroPatScene({
    pc: {},
    modelLibrary: {},
    hero,
    camera,
    canvas: {
      getBoundingClientRect: () => ({
        left: 20,
        top: 30,
        right: 220,
        bottom: 230,
      }),
    },
    mapRoot: { addChild: (entity) => calls.push(["attach", entity]) },
    isInventoryVisible: () => inventoryVisible,
  });
  calls.length = 0;

  return {
    scene,
    hero,
    camera,
    hand,
    gesture,
    calls,
    setInventoryVisible: (value) => {
      inventoryVisible = value;
    },
  };
}

it("projects the same head contact and mood offset without mutating the hero position", () => {
  const f = fixture();
  assert.deepEqual(f.scene.screenPosition(), {
    x: 100,
    y: 50,
    radius: 5,
  });
  assert.deepEqual(f.scene.screenPosition(0.12), {
    x: 100,
    y: 51.2,
    radius: 5,
  });
  assert.equal(f.hero.patPosition.y, 5);
  f.camera.camera = null;
  assert.equal(f.scene.screenPosition(), null);
});

it("uses canvas-relative coordinates and the elliptical hit area", () => {
  const f = fixture();
  assert.equal(f.gesture.hitTest({
    clientX: 120,
    clientY: 80,
  }), true);
  assert.equal(f.gesture.hitTest({
    clientX: 125,
    clientY: 80,
  }), true);
  assert.equal(f.gesture.hitTest({
    clientX: 126,
    clientY: 80,
  }), false);
  assert.equal(f.gesture.hitTest({
    clientX: 120,
    clientY: 85,
  }), false);
  assert.equal(f.gesture.hitTest({
    clientX: 19,
    clientY: 80,
  }), false);
});

it("suppresses pointer hits for inventory, first-person mode and an unavailable hero", () => {
  const f = fixture();
  const point = {
    clientX: 120,
    clientY: 80,
  };
  f.setInventoryVisible(true);
  assert.equal(f.gesture.hitTest(point), false);
  f.setInventoryVisible(false);
  f.camera.firstPersonEnabled = true;
  assert.equal(f.gesture.hitTest(point), false);
  f.camera.firstPersonEnabled = false;
  f.hero.canBePatted = false;
  assert.equal(f.gesture.hitTest(point), false);
});

it("keeps gesture and programmatic pat admission and contact timing", () => {
  const f = fixture();
  f.gesture.pat();
  assert.deepEqual(f.calls, ["pat"]);
  assert.equal(f.hand.options.getViewRotation(), 2);
  assert.deepEqual(f.hand.options.getPatPosition(), f.hero.patPosition);
  f.hand.options.onContact();
  assert.deepEqual(f.calls, ["pat", "contact"]);
  f.hero.canBePatted = false;
  assert.equal(f.scene.pat(), false);
  f.gesture.pat();
  assert.deepEqual(f.calls, ["pat", "contact"]);
});

it("updates the hand and disconnects gestures before destroying it", () => {
  const f = fixture();
  f.scene.update(0.1);
  f.scene.destroy();
  assert.deepEqual(f.calls, [["update", 0.1], "gesture:destroy", "hand:destroy"]);
});
