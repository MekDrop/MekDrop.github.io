import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { it } from "node:test";
import { EventHandler } from "playcanvas";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => specifier.endsWith("patting-hand.glb?url") ? {
    url: "data:text/javascript,export default %22patting-hand.glb%22",
    shortCircuit: true,
  } : nextResolve(specifier, context),
});
const { LatchPatPresentation } = await import("../../../../../../src/game/objects/enemies/latch-slug/LatchPatPresentation.js");
hooks.deregister();

it("ignores callbacks already queued when the slug presentation is destroyed", () => {
  const app = new EventHandler();
  const presentation = Object.create(LatchPatPresentation.prototype);
  let handDestroyed = 0, hudDestroyed = 0, annoyanceDestroyed = 0;
  presentation.owner = {
    affection: {
      available: false,
      canPat: true,
    },
  };
  presentation.hand = {
    entity: { enabled: true },
    destroy: () => {
      handDestroyed++; presentation.hand.entity = null;
    },
    update: () => assert.fail("Destroyed hand updated"),
    pat: () => assert.fail("Destroyed hand patted"),
  };
  presentation.hud = {
    update: () => assert.fail("Destroyed HUD rendered"),
    destroy: () => {
      hudDestroyed++;
    },
  };
  presentation.annoyanceHud = {
    update: () => assert.fail("Destroyed annoyance HUD rendered"),
    destroy: () => {
      annoyanceDestroyed++;
    },
  };
  app.on("update", () => presentation.destroy());
  presentation.updateHandle = app.on("update", presentation.update, presentation);
  presentation.renderHandle = app.on("prerender", presentation.render, presentation);
  app.fire("update", 0.016);
  presentation.update(0.016);
  presentation.render();
  assert.equal(presentation.pat(), false);
  presentation.destroy();
  app.fire("prerender");
  assert.equal(handDestroyed, 1);
  assert.equal(hudDestroyed, 1);
  assert.equal(annoyanceDestroyed, 1);
});
