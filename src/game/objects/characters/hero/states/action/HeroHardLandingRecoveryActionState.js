import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

/**
 * An authored fall-and-get-up reaction. Bridge riders hold its seated pose
 * until stable ground; live physics and water/death actions keep their priority.
 */
export class HeroHardLandingRecoveryActionState extends HeroRuntimeActionState {
  /**
   * Physics reports forceful ordinary jump landings too. React only when a
   * deliberate jump ends substantially below its launch support, or when the
   * impact followed an unplanned fall such as a collapsing bridge.
   * @param {{jumping: boolean, landingHeight: number, launchHeight: number}} situation
   * @returns {boolean}
   */
  static shouldReactToLanding({ jumping, landingHeight, launchHeight }) {
    return !jumping || landingHeight < launchHeight - 1.1;
  }

  /**
   * @param {{position: import("src/game/objects/ObjectTypes.js").Point3, grounded: boolean, jumping: boolean, cells: import("src/game/objects/ObjectTypes.js").GridPoint[], elevation: number, cols: number, rows: number}} situation
   * @returns {boolean}
   */
  static isStandingOnCollapsingBridge({ position, grounded, jumping, cells, elevation, cols, rows }) {
    if (!grounded || jumping || Math.abs(position.y - elevation) > 0.5) {
      return false;
    }
    const col = Math.round(position.x + (cols - 1) / 2);
    const row = Math.round(position.z + (rows - 1) / 2);

    return cells.some(/**
     * @param {import("src/game/objects/ObjectTypes.js").GridPoint} cell
     */
      (cell) => cell.col === col && cell.row === row);
  }

  constructor() {
    super(HERO_ACTION.HARD_LANDING_RECOVERY, {
      animation: HERO_ANIMATION.HARD_LANDING_RECOVERY,
      blocksMovement: true,
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
      locksHeadForward: true,
    });
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    this.payload.elapsed = 0;
    owner.feedback.landingRecovery.begin();
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const feedback = owner.feedback.landingRecovery;
    if (this.payload.bridgeCollapse) {
      if (this.payload.elapsed < 0.35) {
        this.payload.elapsed = Math.min(0.35, this.payload.elapsed + owner.deltaTime);

        return;
      }
      if (!feedback.stableGrounded()) {
        this.payload.gettingUp = false;
        this.payload.elapsed = 0.35;

        return;
      }
      if (!this.payload.gettingUp) {
        this.payload.gettingUp = true;
        this.payload.elapsed = 0.6;
      }
    } else if (!feedback.grounded()) {
      owner.finish();

      return;
    }
    this.payload.elapsed += owner.deltaTime;
    if (this.payload.elapsed >= feedback.duration) {
      owner.finish();
      owner.feedback.actionComplete?.(this.action);
    }
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    owner.feedback.landingRecovery.end();
    super.exit(owner);
  }
}
