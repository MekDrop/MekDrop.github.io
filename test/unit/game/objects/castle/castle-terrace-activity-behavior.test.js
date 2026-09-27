import assert from "node:assert/strict";
import { it } from "node:test";
import { KingTrainingBehavior } from "../../../../../src/game/objects/castle/KingTrainingBehavior.js";
import { PrincessLeisureBehavior } from "../../../../../src/game/objects/castle/PrincessLeisureBehavior.js";
import { QueenLeisureBehavior } from "../../../../../src/game/objects/castle/QueenLeisureBehavior.js";
import { TerraceServantBehavior } from "../../../../../src/game/objects/castle/TerraceServantBehavior.js";
import { KingCombatTrainingState } from "../../../../../src/game/objects/castle/states/terrace/king/KingCombatTrainingState.js";
import { KingOnThroneState } from "../../../../../src/game/objects/castle/states/terrace/king/KingOnThroneState.js";
import { PrincessDrinkTeaState } from "../../../../../src/game/objects/castle/states/terrace/princess/PrincessDrinkTeaState.js";
import { PrincessOnThroneState } from "../../../../../src/game/objects/castle/states/terrace/princess/PrincessOnThroneState.js";
import { QueenOnThroneState } from "../../../../../src/game/objects/castle/states/terrace/queen/QueenOnThroneState.js";
import { QueenReadState } from "../../../../../src/game/objects/castle/states/terrace/queen/QueenReadState.js";
import { ServantOffstageState } from "../../../../../src/game/objects/castle/states/terrace/servant/ServantOffstageState.js";
import { QueenWantsSunbedState } from "../../../../../src/game/objects/castle/states/terrace/queen/QueenWantsSunbedState.js";
import { PrincessWantsTeaState } from "../../../../../src/game/objects/castle/states/terrace/princess/PrincessWantsTeaState.js";
import { TERRACE_SERVICE } from "../../../../../src/game/enum/TerraceService.js";
import { RoyalWishFulfillment } from "../../../../../src/game/objects/castle/RoyalWishFulfillment.js";

const ROYAL_CASES = [
  [KingTrainingBehavior, KingOnThroneState, null, null,
    KingCombatTrainingState],
  [QueenLeisureBehavior, QueenOnThroneState, QueenWantsSunbedState,
    TERRACE_SERVICE.SUNBED, QueenReadState],
  [PrincessLeisureBehavior, PrincessOnThroneState, PrincessWantsTeaState,
    TERRACE_SERVICE.TEA, PrincessDrinkTeaState],
];

for (const [BehaviorType, ThroneState, WishState, service,
  ActivityState] of ROYAL_CASES) {
  it(`${BehaviorType.name} transfers one royal from throne and back`, () => {
    const throneChanges = [];
    const actions = [];
    const behavior = new BehaviorType((atThrone) =>
      throneChanges.push(atThrone));
    behavior.actionHandler = {
      enter: (state) => actions.push(state.action),
    };

    assert.equal(behavior.phase, ThroneState.name);
    assert.equal(behavior.onThrone, true);
    behavior.requested = true;
    if (WishState) {
      assert.equal(behavior.phase, WishState.name);
      assert.equal(behavior.wish, service);
      assert.equal(behavior.onThrone, true);
      assert.deepEqual(throneChanges, []);
      assert.equal(behavior.fulfillWish(service), true);
    }
    assert.deepEqual(throneChanges, [false]);
    behavior.update(100);
    assert.equal(behavior.phase, ActivityState.name);
    assert.ok(behavior.action);
    assert.ok(behavior.animation);

    behavior.requested = false;
    behavior.update(100);
    assert.equal(behavior.phase, ThroneState.name);
    assert.equal(behavior.onThrone, true);
    assert.deepEqual(throneChanges, [false, true]);
    assert.ok(actions.length > 0);
  });
}

it("fulfills royal wishes before the royal leaves the throne", () => {
  for (const service of [TERRACE_SERVICE.SUNBED, TERRACE_SERVICE.TEA]) {
    const servant = new TerraceServantBehavior();
    assert.equal(servant.fulfill(service), true);
    servant.update(100);
    assert.equal(servant.phase, ServantOffstageState.name);
    assert.equal(servant.ready, true);
    assert.equal(servant.fulfilledService, service);
    assert.ok(servant.action);
    assert.ok(servant.animation);

    assert.equal(servant.release(), true);
    servant.update(100);
    assert.equal(servant.phase, ServantOffstageState.name);
    assert.equal(servant.installedCount, 0);
  }
});


it("brings tea before the princess comes to drink it", () => {
  const princess = new PrincessLeisureBehavior();
  const servant = new TerraceServantBehavior();
  const fulfillment = new RoyalWishFulfillment(princess, servant);

  fulfillment.update(true);
  assert.equal(princess.phase, PrincessWantsTeaState.name);
  assert.equal(princess.onThrone, true);

  servant.update(100);
  fulfillment.update(true);
  assert.equal(servant.fulfilledService, TERRACE_SERVICE.TEA);
  assert.equal(princess.onThrone, false);
});
