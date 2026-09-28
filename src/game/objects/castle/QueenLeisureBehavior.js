import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { TERRACE_SERVICE } from "../../enum/TerraceService.js";
import { QueenDismountSunbedState } from "./states/terrace/queen/QueenDismountSunbedState.js";
import { QueenEnterLeisureState } from "./states/terrace/queen/QueenEnterLeisureState.js";
import { QueenMountSunbedState } from "./states/terrace/queen/QueenMountSunbedState.js";
import { QueenOnThroneState } from "./states/terrace/queen/QueenOnThroneState.js";
import { QueenReadState } from "./states/terrace/queen/QueenReadState.js";
import { QueenReturnToThroneState } from "./states/terrace/queen/QueenReturnToThroneState.js";
import { QueenWantsSunbedState } from "./states/terrace/queen/QueenWantsSunbedState.js";
import { RoyalTerraceActivityBehavior } from "./RoyalTerraceActivityBehavior.js";

export class QueenLeisureBehavior extends RoyalTerraceActivityBehavior {
  /**
   *
   * @param {(atThrone: boolean) => void} onThroneChange
   */
  constructor(onThroneChange) {
    const walkSpeed = ROYAL_WALK_SPEED.QUEEN;
    const walkDuration = 0.7 + 2.5 / walkSpeed;
    super({
      onThroneChange,
      walkSpeed,
      service: TERRACE_SERVICE.SUNBED,
      states: [
        new QueenOnThroneState(),
        new QueenWantsSunbedState(),
        new QueenEnterLeisureState(walkDuration),
        new QueenMountSunbedState(4.5),
        new QueenReadState(),
        new QueenDismountSunbedState(3.8),
        new QueenReturnToThroneState(walkDuration),
      ],
      phases: {
        throne: QueenOnThroneState.name,
        wish: QueenWantsSunbedState.name,
        enter: QueenEnterLeisureState.name,
        prepare: QueenMountSunbedState.name,
        activity: QueenReadState.name,
        finish: QueenDismountSunbedState.name,
        return: QueenReturnToThroneState.name,
      },
    });
  }
}
