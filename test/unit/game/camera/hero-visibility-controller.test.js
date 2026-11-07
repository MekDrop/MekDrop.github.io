import assert from "node:assert/strict";
import { it } from "node:test";
import { BoundingBox, Vec3 } from "playcanvas";
import { HeroVisibilityController } from "../../../../src/game/camera/HeroVisibilityController.js";

for (const initiallyVisible of [true, false]) {
  it(`keeps visibility probes temporary when the hero is ${initiallyVisible ? "visible" : "occluded"}`, async () => {
    const previousWindow = globalThis.window;
    let scheduled;
    globalThis.window = {
      setTimeout: (callback) => {
        scheduled = callback;

        return 1;
      },
      clearTimeout: () => {},
    };
    const hero = {
      findComponents: () => [{
        enabled: true,
        entity: { enabled: true },
        meshInstances: [{
          visible: true,
          aabb: new BoundingBox(new Vec3(0, 1, 0), new Vec3(0.5, 1, 0.5)),
        }],
      }],
    };
    const changes = [];
    const samples = [];
    let rotation = 0;
    let reads = 0;
    class Picker {
      resize() {}
      prepare() {}
      destroy() {}
      getSelectionAsync(x, y, width, height) {
        // The torso patch is covered by an enemy; the head remains visible.
        // At this zoom its pixels lie well outside the old fixed sample.
        samples.push([x, y, width, height]);
        reads += 1;

        return Promise.resolve(initiallyVisible || reads > 1 ? [{ node: hero }] : []);
      }
    }
    const controller = new HeroVisibilityController({
      pc: {
        Vec3,
        Picker,
      },
      app: { scene: {} },
      canvas: {
        clientWidth: 800,
        clientHeight: 600,
      },
      camera: { worldToScreen: (point) => new Vec3(400 + point.x * 40, 300 - point.y * 40, 1) },
      hero,
      getRotation: () => rotation,
      setRotation: (value, temporary = false) => {
        rotation = value;
        changes.push({
          value,
          temporary,
        });
      },
    });
    try {
      controller.schedule();
      scheduled();
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(samples, initiallyVisible
        ? [[95, 55, 10, 20]]
        : [[95, 55, 10, 20], [95, 55, 10, 20]]);
      assert.deepEqual(changes.filter((change) => !change.temporary),
        initiallyVisible ? [] : [{
          value: 3,
          temporary: false,
        }]);
      assert.equal(rotation, initiallyVisible ? 0 : 3);
      assert.equal(changes[0].temporary, true);
      assert.equal(changes[1].value, 0);
      assert.equal(changes[1].temporary, true);
    } finally {
      controller.destroy();
      globalThis.window = previousWindow;
    }
  });
}
