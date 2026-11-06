import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, EventHandler } from "playcanvas";
import { KingTrainingExpression } from "../../../../../../../src/game/objects/castle/rooms/terrace/KingTrainingExpression.js";

it("layers expression without scale drift and restores the authored eyes on teardown", () => {
  const app = new EventHandler();
  const model = new Entity();
  const eye = new Entity("Royal left eye");
  eye.setLocalScale(2, 3, 4);
  model.addChild(eye);
  const acting = new KingTrainingExpression(model, app);
  acting.pose("sword", "SwordThrust");
  for (let frame = 0; frame < 60; frame++) {
    app.fire("postupdate", 1 / 60);
  }
  assert.ok(eye.getLocalScale().y < 3 && eye.getLocalScale().y > 1);
  assert.equal(eye.getLocalScale().x, 2);
  acting.pose("sword", "SwordFailureLeft");
  for (let frame = 0; frame < 60; frame++) {
    app.fire("postupdate", 1 / 60);
  }
  assert.ok(eye.getLocalScale().y > 3);
  acting.destroy();
  assert.equal(eye.getLocalScale().y, 3);
  app.fire("postupdate", 1);
  assert.equal(eye.getLocalScale().y, 3);
});
