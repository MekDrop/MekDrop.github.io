import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { HeroLifeHud } from "../../../../src/game/ui/HeroLifeHud.js";

class Entity {
  children = [];
  enabled = true;
  constructor(name) {
    this.name = name;
  }
  addComponent(type, options) {
    this[type] = {
      ...options,
      syncDrawOrder: () => {},
    };
  }
  addChild(child) {
    this.children.push(child);
  }
  setLocalPosition() {}
  setLocalEulerAngles() {}
  destroy() {}
}

test("partial damage drains the heart while retaining the life count and only full loss breaks it", t => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    getComputedStyle: globalThis.getComputedStyle,
    Element: globalThis.Element,
  };
  const style = { getPropertyValue: name => name.startsWith("--q-") ? "#445566" : name.endsWith("font-family") ? "sans-serif" : "4px" };
  globalThis.Element = class {};
  globalThis.document = {
    body: new Element(),
    documentElement: new Element(),
  };
  globalThis.window = { getComputedStyle: () => style };
  globalThis.getComputedStyle = () => style;
  t.after(() => Object.assign(globalThis, previous));
  const records = [];
  class Hud extends HeroLifeHud {
    createTextureRecord(name, width, height) {
      const canvas = {
          width,
          height,
        }, rectangles = [];
      const context = new Proxy({
        canvas,
        rect: (...values) => rectangles.push(values),
        createLinearGradient: () => ({ addColorStop: () => {} }),
      }, { get: (target, key) => target[key] ?? (() => {}) });
      const texture = {
        uploads: 0,
        setSource() {
          this.uploads++;
        },
      };
      const record = {
        name,
        canvas,
        context,
        texture,
        rectangles,
      };
      records.push(record);

      return record;
    }
    createPanelTexture() {
      return {};
    }
    drawNumber(record, value) {
      record.value = value;
    }
  }
  const app = new pc.EventHandler();
  const hud = new Hud({
    pc: {
      ...pc,
      Entity,
    },
    app,
  });
  const heart = records.find(record => record.name === "Hero heart icon");
  const count = records.find(record => record.name === "Hero life number");
  const fragment = hud.entity.children[0].children.find(entity => entity.name === "Hero life icon left fragment");
  hud.setLives(2.92, 3);
  assert.ok(heart.rectangles.at(-1)[1] > 13, "the first small scratch must drain the painted heart, not transparent texture padding");
  assert.equal(count.value, 3);
  hud.setLives(2.75, 3);
  assert.equal(hud.lives, 2.75);
  assert.equal(count.value, 3);
  assert.deepEqual(heart.rectangles.at(-1), [0, 21.75, 64, 35.25]);
  assert.equal(fragment.enabled, false);
  const uploads = heart.texture.uploads;
  hud.setLives(2.75, 3);
  assert.equal(heart.texture.uploads, uploads, "unchanged health must reuse the texture");
  hud.setLives(2.5, 3);
  assert.deepEqual(heart.rectangles.at(-1), [0, 33.5, 64, 23.5]);
  assert.equal(fragment.enabled, false);
  hud.setLives(2, 3);
  assert.equal(count.value, 2);
  assert.equal(fragment.enabled, true);
  hud.update(1);
  assert.equal(fragment.enabled, false);
  assert.deepEqual(heart.rectangles.at(-1), [0, 10, 64, 47]);
  app.fire("royal:damaged", 2.5);
  assert.equal(hud.developmentState.castleLives, 2.5);
  const shield = records.find(record => record.name === "Castle shield icon");
  assert.deepEqual(shield.rectangles.at(-1), [0, 33, 64, 26]);
  app.fire("royal:damaged", 2.9);
  assert.equal(hud.developmentState.castleLives, 2.5, "another healthier royal cannot refill the weakest royal's shield");
  hud.destroy();
});
