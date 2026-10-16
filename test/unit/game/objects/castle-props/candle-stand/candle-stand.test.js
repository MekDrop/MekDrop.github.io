import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith(".glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/Fire.js")) {
      return {
        url: 'data:text/javascript,export class Fire { static attach(pc, model, position) { (model.flames ??= []).push({position, volume: arguments[3]}); } }',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/LanternGlass.js")) {
      return {
        url: 'data:text/javascript,export class LanternGlass { static add() {} }',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/FireEffect.js")) {
      return {
        url: 'data:text/javascript,export class FireEffect { constructor() { this.entity = new globalThis.CandleTestEntity("single flame"); } add(options) { this.entity.flame = options; } destroy() { this.entity.destroy(); } }',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/AuthoredMeshPhysics.js")) {
      return {
        url: 'data:text/javascript,export function addAuthoredMeshPhysics() {}',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/DynamicRenderBatch.js")) {
      return {
        url: 'data:text/javascript,export class DynamicRenderBatch { destroy() {} }',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { CandleStand } = await import("../../../../../../src/game/objects/castle-props/candle-stand/CandleStand.js");
hooks.deregister();

class CandleEntity extends pc.Entity {
  addComponent(type, options) {
    this[type] = options;
  }
}
globalThis.CandleTestEntity = CandleEntity;

test("variants keep model/collision selection, scaled wick positions and effect cleanup", () => {
  for (const variant of ["single", "floor", "table"]) {
    const app = new pc.EventHandler();
    app.assets = { find: () => ({ resource: {} }) };
    const urls = [];
    const candle = new CandleStand({
      pc: {
        ...pc,
        Entity: CandleEntity,
        Application: { getApplication: () => app },
      },
      modelLibrary: {
        instantiate: url => {
          urls.push(url);
          const model = new CandleEntity("model");
          for (const [index, name] of ["Tall candle wick", "Middle candle wick", "Short candle wick"].entries()) {
            const wick = new CandleEntity(name);
            wick.setLocalPosition(index * 0.1, 0.5 - index * 0.1, 0.03);
            model.addChild(wick);
          }

          return model;
        },
      },
      definition: {
        id: variant,
        object: "CandleStand",
        variant,
        position: {
          x: 4,
          y: 2,
          z: 3,
        },
        rotation: 90,
        scale: 2,
      },
    });
    const expected = variant === "floor" ? "floor-candelabrum" : variant === "table" ? "table-candles" : "single-candle-stand";
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.endsWith(`${expected}.glb?url`)));
    const model = candle.visualRoots[0].children[0];
    if (variant === "single") {
      assert.equal(app.hasEvent("update"), true);
      assert.equal(model.findByName("single flame").flame.y, 0.64);
      assert.ok(Math.abs(model.findByName("Candle warm glow").getLocalPosition().y - 0.72) < 1e-6);
    } else {
      assert.equal(model.flames.length, 3);
      for (const [index, flame] of model.flames.entries()) {
        assert.ok(Math.abs(flame.position.x - index * 0.1) < 1e-5);
        assert.ok(Math.abs(flame.position.y - (0.5 - index * 0.1)) < 1e-5);
        assert.ok(Math.abs(flame.position.z - 0.03) < 1e-5);
        assert.equal(flame.volume.y, variant === "floor" ? 0.162 : 0.0828);
      }
    }
    candle.destroy();
    assert.equal(app.hasEvent("update"), false);
    assert.equal(model.parent, null);
  }
});
