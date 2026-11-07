import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { LatchPack } from "../../../../../../src/game/objects/enemies/latch-slug/LatchPack.js";
import { SceneObjectRegistry } from "../../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

it("shares indexed people while checking live range, death and newly spawned companions", () => {
  const { human, owner } = fixture();
  human.entity.setPosition(20, 0, 0);
  const objects = new SceneObjectRegistry();
  owner.runtime.objects = objects;
  const companion = {
    entity: new Entity(),
    isRoyal: true,
  };
  companion.entity.setPosition(1, 0, 0);
  objects.add("actor", companion);
  assert.equal(owner.pack.resolve(), companion);
  companion.alive = false;
  assert.equal(owner.pack.resolve(), null);
  const servant = {
    entity: new Entity(),
    definition: { object: "Servant" },
  };
  servant.entity.setPosition(1.5, 0, 0);
  objects.add("actor", servant);
  assert.equal(owner.pack.resolve(), servant);
  servant.entity.setPosition(4, 0, 0);
  assert.equal(owner.pack.resolve(), null);
});

function fixture() {
  const human = { entity: new Entity() };
  const owner = {
    alive: true,
    position: new Vec3(),
    radius: 0.42,
    elapsed: 0,
    actors: [],
    runtime: { getHero: () => human },
    targetPosition: actor => actor.entity.getPosition(),
    distanceTo: actor => owner.position.distance(actor.entity.getPosition()),
  };
  owner.pack = new LatchPack(owner);

  return {
    human,
    owner,
  };
}

it("only nearby slugs notice a human and stop following when the human gets too far away", () => {
  const { human, owner } = fixture();
  human.entity.setPosition(2.01, 0, 0);
  assert.equal(owner.pack.resolve(), null);
  human.entity.setPosition(2, 0, 0);
  assert.equal(owner.pack.resolve(), human);
  human.entity.setPosition(2.8, 0, 0);
  assert.equal(owner.pack.resolve(), human);
  human.entity.setPosition(3.01, 0, 0);
  assert.equal(owner.pack.resolve(), null);
});

it("yields to a slug ahead without being blocked by slugs behind, far away or on another floor", () => {
  const { owner } = fixture();
  const other = fixture().owner;
  owner.actors.push(other);
  const destination = new Vec3(2, 0, 0);
  other.position.set(1, 0, 0);
  assert.equal(owner.pack.isCrowdedToward(destination), true);
  other.position.set(-1, 0, 0);
  assert.equal(owner.pack.isCrowdedToward(destination), false);
  other.position.set(2, 0, 0);
  assert.equal(owner.pack.isCrowdedToward(destination), false);
  other.position.set(0.5, 1, 0);
  assert.equal(owner.pack.isCrowdedToward(destination), false);
  other.position.set(0.5, 0, 0);
  other.carrier = {};
  assert.equal(owner.pack.isCrowdedToward(destination), false);
});
