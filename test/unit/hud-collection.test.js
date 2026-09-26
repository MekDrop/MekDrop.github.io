import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HudCollection } from "../../src/game/ui/HudCollection.js";

class TestHud {
  constructor(context) {
    this.context = context;
    this.attachCount = 0;
    this.destroyCount = 0;
    this.updates = [];
  }

  attach() {
    this.attachCount += 1;
  }

  update(deltaTime) {
    this.updates.push(deltaTime);
  }

  destroy() {
    this.destroyCount += 1;
  }
}

class StaticHud {
  attachCount = 0;
  destroyCount = 0;

  attach() {
    this.attachCount += 1;
  }

  destroy() {
    this.destroyCount += 1;
  }
}

describe("HudCollection", () => {
  it("adds each HUD class once with the shared rendering context", () => {
    const context = { pc: {}, app: {}, theme: {} };
    const huds = new HudCollection(context);

    const hud = huds.add(TestHud, { custom: true, app: "ignored" });

    assert.equal(huds.add(TestHud), hud);
    assert.equal(huds.getHud(TestHud), hud);
    assert.equal(hud.attachCount, 1);
    assert.deepEqual(hud.context, { ...context, custom: true });
  });

  it("updates compatible HUDs and ignores HUDs without an update method", () => {
    const huds = new HudCollection({ pc: {}, app: {}, theme: {} });
    const animatedHud = huds.add(TestHud);
    huds.add(StaticHud);

    huds.update(0.25);

    assert.deepEqual(animatedHud.updates, [0.25]);
  });

  it("removes individual HUDs and destroys the remainder as a collection", () => {
    const huds = new HudCollection({ pc: {}, app: {}, theme: {} });
    const removedHud = huds.add(TestHud);
    const remainingHud = huds.add(StaticHud);

    assert.equal(huds.remove(TestHud), true);
    assert.equal(huds.remove(TestHud), false);
    assert.equal(removedHud.destroyCount, 1);
    assert.equal(huds.getHud(TestHud), null);

    huds.destroy();

    assert.equal(remainingHud.destroyCount, 1);
    assert.equal(huds.size, 0);
  });
});
