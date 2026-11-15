import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { MaskShaman } from "../../../../../../src/game/objects/enemies/mask-shaman/MaskShaman.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { WireGremlin } from "../../../../../../src/game/objects/enemies/wire-gremlin/WireGremlin.js";

const fixture = () => {
  const actors = [];
  const make = (Type, id) => {
    const actor = new Type({
      pc,
      app: {},
      definition: { id },
      runtime: { objects: actors },
    });
    actors.push(actor);

    return actor;
  };
  const shaman = make(MaskShaman, "source");
  const royal = make(Enemy, "royal");
  royal.isRoyal = true;
  royal.entity.setPosition(0, 0, -2);

  return {
    actors,
    make,
    shaman,
    royal,
  };
};

test("Wire suspends a pending territorial contact without releasing the claim", () => {
  const { make, shaman } = fixture();
  const occupant = make(WireGremlin, "occupant");
  const challenger = make(WireGremlin, "challenger");
  const tower = make(Enemy, "tower");
  tower.isSabotageTower = true;
  tower.beginSabotage = () => () => {};
  occupant.pursue();
  challenger.pursue();
  assert.equal(challenger.stateName, "GremlinTerritorialState");
  shaman.update(0.86);
  challenger.update(1);
  assert.equal(occupant.health, 100);
  assert.equal(challenger.target, tower);
  assert.equal(occupant.target, tower);
  assert.equal(challenger.stateElapsed, 0);
  shaman.onBellRung({ duration: 2 });
  challenger.update(0.71);
  assert.equal(occupant.health, 92);
  assert.equal(occupant.target, tower);
});
