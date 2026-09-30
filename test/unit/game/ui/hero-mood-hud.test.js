import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroMoodHud } from "../../../../src/game/ui/HeroMoodHud.js";

class Entity {
  children = [];
  addComponent(type, options) {
    this[type] = { ...options, scale: 2, syncDrawOrder() {} };
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
  setLocalEulerAngles(...rotation) {
    this.rotation = rotation;
  }
  destroy() {
    this.destroyed = true;
  }
}

class TestMoodHud extends HeroMoodHud {
  createDrawnTexture(name) {
    return { name };
  }
}

it("tracks mood, projection, growth, reduced motion and visibility without DOM icons", () => {
  let mood = null;
  const preference = { matches: true };
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => preference;
  try {
    const pc = { Entity, Vec2: class {}, Vec4: class {} };
    const app = { graphicsDevice: { canvas: { clientWidth: 640, width: 1280 } } };
    const hud = new TestMoodHud({ pc, app, getMood: () => mood });
    const icon = hud.entity.children[0];
    hud.update(0.016);
    assert.equal(icon.enabled, false);
    mood = { kind: "happy", reactionProgress: 1, screen: { x: 123, y: 234, radius: 10 } };
    hud.update(0.016);
    assert.equal(icon.enabled, true);
    assert.equal(icon.element.texture.name, "Hero mood happy");
    assert.deepEqual(icon.position, [123, -(234 + 6 * 1.9), 0]);
    assert.deepEqual(icon.scale, [1, 1, 1]);
    assert.equal(icon.element.width, 48 * 1.9);
    assert.equal(icon.element.height, 40 * 1.9);
    // Zoom changes the projected hero radius, never the icon's screen size.
    for (const radius of [5, 80, 10]) {
      mood.screen.radius = radius;
      hud.update(0);
      const glyphBottom = -icon.position[1] - 6 * 1.9;
      assert.ok(Math.abs(234 - glyphBottom) < 1e-10);
      assert.equal(icon.element.width, 48 * 1.9);
      assert.equal(icon.element.height, 40 * 1.9);
    }
    // HUD scaling also preserves the CSS pixel size.
    hud.entity.screen.scale = 4;
    hud.update(0);
    assert.equal(icon.element.width * 2, 48 * 1.9);
    assert.equal(icon.element.height * 2, 40 * 1.9);
    hud.entity.screen.scale = 2;
    hud.update(0);
    assert.deepEqual(icon.rotation, [0, 0, 0]);
    assert.equal(icon.element.opacity, 1);
    mood.kind = "agitated";
    hud.update(0.016);
    assert.equal(icon.element.texture.name, "Hero mood agitated");
    preference.matches = false;
    mood.kind = "angry";
    hud.update(0.06);
    assert.equal(icon.element.texture.name, "Hero mood agitated");
    assert.ok(icon.element.opacity < 1);
    hud.update(0.07);
    assert.equal(icon.element.texture.name, "Hero mood angry");
    mood.screen = null;
    hud.update(0.016);
    assert.equal(icon.enabled, false);
    mood.kind = "calm";
    mood.screen = { x: 123, y: 234, radius: 10 };
    hud.update(0.016);
    assert.equal(icon.enabled, false);
    const root = hud.entity;
    hud.destroy();
    assert.equal(root.destroyed, true);
  } finally {
    globalThis.matchMedia = originalMatchMedia;
  }
});
