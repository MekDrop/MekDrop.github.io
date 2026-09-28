import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { TERRACE_SERVICE } from "../../enum/TerraceService.js";
import { PrincessDrinkTeaState } from "./states/terrace/princess/PrincessDrinkTeaState.js";
import { PrincessEnterLeisureState } from "./states/terrace/princess/PrincessEnterLeisureState.js";
import { PrincessOnThroneState } from "./states/terrace/princess/PrincessOnThroneState.js";
import { PrincessReturnToThroneState } from "./states/terrace/princess/PrincessReturnToThroneState.js";
import { PrincessSitState } from "./states/terrace/princess/PrincessSitState.js";
import { PrincessStandState } from "./states/terrace/princess/PrincessStandState.js";
import { PrincessWantsTeaState } from "./states/terrace/princess/PrincessWantsTeaState.js";
import { RoyalTerraceActivityBehavior } from "./RoyalTerraceActivityBehavior.js";

export class PrincessLeisureBehavior extends RoyalTerraceActivityBehavior {
  /**
   *
   * @param {(atThrone: boolean) => void} onThroneChange
   */
  constructor(onThroneChange) {
    const walkSpeed = ROYAL_WALK_SPEED.PRINCESS;
    const walkDuration = 0.7 + 2.5 / walkSpeed;
    super({
      onThroneChange,
      walkSpeed,
      service: TERRACE_SERVICE.TEA,
      states: [
        new PrincessOnThroneState(),
        new PrincessWantsTeaState(),
        new PrincessEnterLeisureState(walkDuration),
        new PrincessSitState(1.4),
        new PrincessDrinkTeaState(),
        new PrincessStandState(1.4),
        new PrincessReturnToThroneState(walkDuration),
      ],
      phases: {
        throne: PrincessOnThroneState.name,
        wish: PrincessWantsTeaState.name,
        enter: PrincessEnterLeisureState.name,
        prepare: PrincessSitState.name,
        activity: PrincessDrinkTeaState.name,
        finish: PrincessStandState.name,
        return: PrincessReturnToThroneState.name,
      },
    });
  }
}
