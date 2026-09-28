import { TERRACE_DOOR_INSPECTION_PHASE as PHASE } from "../../enum/TerraceDoorInspectionPhase.js";
import { ServantStateMachine } from "./ServantStateMachine.js";
import { ServantWaitState } from "./states/servant/ServantWaitState.js";
import { ServantNoticeState } from "./states/servant/ServantNoticeState.js";
import { ServantWalkOutState } from "./states/servant/ServantWalkOutState.js";
import { ServantLookLeftState } from "./states/servant/ServantLookLeftState.js";
import { ServantLookRightState } from "./states/servant/ServantLookRightState.js";
import { ServantReturnState } from "./states/servant/ServantReturnState.js";
import { ServantGraspState } from "./states/servant/ServantGraspState.js";
import { ServantCloseState } from "./states/servant/ServantCloseState.js";
import { ServantReleaseState } from "./states/servant/ServantReleaseState.js";
import { ServantLeaveState } from "./states/servant/ServantLeaveState.js";

const STATES = [
  new ServantWaitState({
    phase: PHASE.WAIT,
    duration: 30,
    nextPhase: PHASE.NOTICE,
  }),
  new ServantNoticeState({
    phase: PHASE.NOTICE,
    duration: 1.2,
    nextPhase: PHASE.WALK_OUT,
  }),
  new ServantWalkOutState({
    phase: PHASE.WALK_OUT,
    duration: 3,
    nextPhase: PHASE.LOOK_LEFT,
  }),
  new ServantLookLeftState({
    phase: PHASE.LOOK_LEFT,
    duration: 1.8,
    nextPhase: PHASE.LOOK_RIGHT,
  }),
  new ServantLookRightState({
    phase: PHASE.LOOK_RIGHT,
    duration: 2.4,
    nextPhase: PHASE.RETURN,
  }),
  new ServantReturnState({
    phase: PHASE.RETURN,
    duration: 2,
    nextPhase: PHASE.GRASP,
  }),
  new ServantGraspState({
    phase: PHASE.GRASP,
    duration: 0.7,
    nextPhase: PHASE.CLOSE,
  }),
  new ServantCloseState({
    phase: PHASE.CLOSE,
    duration: 2,
    nextPhase: PHASE.RELEASE,
  }),
  new ServantReleaseState({
    phase: PHASE.RELEASE,
    duration: 0.5,
    nextPhase: PHASE.LEAVE,
  }),
  new ServantLeaveState({
    phase: PHASE.LEAVE,
    duration: 1.8,
    nextPhase: PHASE.IDLE,
  }),
];

/**
 * Game-time choreography: no timeout survives a pause or a destroyed castle.
 */
export class TerraceDoorInspection extends ServantStateMachine {
  constructor() {
    super({
      idlePhase: PHASE.IDLE,
      initialPhase: PHASE.WAIT,
      states: STATES,
      /**
       *
       * @param {import("./states/servant/AbstractServantState.js").AbstractServantState} state
       * @param {{doorwayBusy: boolean}|null} context
       */
      holdState: (state, context) =>
        state.phase === PHASE.WAIT && context?.doorwayBusy,
    });
  }

  /**
   *
    * @returns {boolean}
   */
  get inspecting() {
    return this.active && this.phase !== PHASE.WAIT;
  }

  /**
   *
    * @returns {boolean}
   */
  get doorOpen() {
    return (
      this.active &&
      ![PHASE.CLOSE, PHASE.RELEASE, PHASE.LEAVE].includes(this.phase)
    );
  }

  /**
   *
   * @param {number} deltaTime
   * @param {boolean} doorwayBusy
   */
  update(deltaTime, doorwayBusy = false) {
    super.update(deltaTime, { doorwayBusy });
  }
}
