import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { KingCombatTrainingState } from "./states/terrace/king/KingCombatTrainingState.js";
import { KingEnterTrainingState } from "./states/terrace/king/KingEnterTrainingState.js";
import { KingFinishTrainingState } from "./states/terrace/king/KingFinishTrainingState.js";
import { KingOnThroneState } from "./states/terrace/king/KingOnThroneState.js";
import { KingPrepareTrainingState } from "./states/terrace/king/KingPrepareTrainingState.js";
import { KingReturnToThroneState } from "./states/terrace/king/KingReturnToThroneState.js";
import { RoyalTerraceActivityBehavior } from "./RoyalTerraceActivityBehavior.js";

export class KingTrainingBehavior extends RoyalTerraceActivityBehavior {
  constructor(onThroneChange) {
    const walkSpeed = ROYAL_WALK_SPEED.KING;
    const walkDuration = 0.7 + 2.5 / walkSpeed;
    super({
      onThroneChange,
      walkSpeed,
      states: [
        new KingOnThroneState(),
        new KingEnterTrainingState(walkDuration),
        new KingPrepareTrainingState(1.4),
        new KingCombatTrainingState(),
        new KingFinishTrainingState(1.4),
        new KingReturnToThroneState(walkDuration),
      ],
      phases: {
        throne: KingOnThroneState.name,
        enter: KingEnterTrainingState.name,
        prepare: KingPrepareTrainingState.name,
        activity: KingCombatTrainingState.name,
        finish: KingFinishTrainingState.name,
        return: KingReturnToThroneState.name,
      },
    });
  }
}
