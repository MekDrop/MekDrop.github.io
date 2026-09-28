import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { RIVER_KIND } from "../../../../enum/RiverKind.js";
import { HeroWaterMotion } from "../../HeroWaterMotion.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

const HEAD_YAW_LIMIT = 46;

export class HeroDrowningActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.DROWNING, {
      animation: HERO_ANIMATION.IDLE,
      exclusive: true,
      incapacitated: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
      controlsHeadPresentation: true,
    });
  }

  tryEnter(owner) {
    const feedback = owner.feedback.drowning;
    const situation = feedback.situation();
    if (
      situation.grounded
      || situation.fallingToDeath
      || situation.respawning
      || situation.verticalVelocity > 0
      || feedback.hasRiverSourceCover(situation.position)
    ) {
      return false;
    }

    const routeEntry = feedback.routeEntryAt(situation.position);
    if (!routeEntry || routeEntry.cell.underBridge) {
      return false;
    }
    const entryClearance = routeEntry.river.kind === RIVER_KIND.LAVA
      ? feedback.lavaEntryClearance
      : feedback.waterEntryClearance;
    if (situation.position.y > routeEntry.cell.elevation + entryClearance) {
      return false;
    }

    if (routeEntry.river.kind === RIVER_KIND.LAVA) {
      owner.transition(HERO_ACTION.BURNING, routeEntry);
    } else {
      owner.transition(HERO_ACTION.DROWNING, routeEntry);
    }
    return true;
  }

  enter(owner) {
    super.enter(owner);
    this.payload = owner.feedback.drowning.begin(this.payload);
  }

  execute(owner) {
    const feedback = owner.feedback.drowning;
    const action = this.payload;
    const position = feedback.position();
    action.elapsed += owner.deltaTime;
    const cells = action.river.cells;
    const terminal = cells[cells.length - 1];
    const targetCell = action.exiting ? terminal : cells[action.targetIndex];
    const direction = feedback.directionVector(targetCell.direction);
    const climbsBridge = targetCell.underBridge
      && feedback.canClimbBridge(targetCell);
    const targetX = targetCell.col - (feedback.mapColumns - 1) / 2
      + (action.exiting
        ? direction.x * feedback.exitDistance
        : climbsBridge
          ? -direction.x * feedback.bridgeApproachOffset
          : 0);
    const targetZ = targetCell.row - (feedback.mapRows - 1) / 2
      + (action.exiting
        ? direction.z * feedback.exitDistance
        : climbsBridge
          ? -direction.z * feedback.bridgeApproachOffset
          : 0);
    const deltaX = targetX - position.x;
    const deltaZ = targetZ - position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= feedback.waypointEpsilon) {
      if (action.exiting) {
        feedback.finishAtWaterfall(direction);
        return;
      }
      if (climbsBridge) {
        owner.transition(HERO_ACTION.BRIDGE_CLIMB, targetCell);
        return;
      }
      if (action.targetIndex < cells.length - 1) {
        action.targetIndex += 1;
      } else {
        action.exiting = true;
      }
    }

    const currentRouteEntry = feedback.routeEntryAt(position);
    const waterElevation = currentRouteEntry?.cell.elevation
      ?? targetCell.elevation;
    const targetY = waterElevation
      - feedback.submergeDepth
      + HeroWaterMotion.offsetAt(action.elapsed);
    const verticalVelocity = Math.max(
      -feedback.sinkSpeed,
      Math.min(
        feedback.sinkSpeed,
        (targetY - position.y) * feedback.sinkSpeed,
      ),
    );
    feedback.setVelocity({
      x: distance > feedback.waypointEpsilon
        ? (deltaX / distance) * feedback.currentSpeed
        : 0,
      y: verticalVelocity,
      z: distance > feedback.waypointEpsilon
        ? (deltaZ / distance) * feedback.currentSpeed
        : 0,
    });
  }

  exit(owner) {
    owner.feedback.drowning.endPresentation?.();
    super.exit(owner);
  }

  present(owner) {
    const elapsed = this.payload.elapsed;
    const scanningYaw =
      Math.sin(elapsed * 9.5) * 29
      + Math.sin(elapsed * 17.3 + 1.2) * 11;
    const startledJerk =
      Math.max(0, Math.sin(elapsed * 4.1) - 0.68)
      * Math.sin(elapsed * 31)
      * 25;
    const yaw = Math.max(
      -HEAD_YAW_LIMIT,
      Math.min(HEAD_YAW_LIMIT, scanningYaw + startledJerk),
    );
    const pitch =
      7 + Math.sin(elapsed * 13.1 + 0.4) * 8 + Math.sin(elapsed * 27) * 3;
    const roll =
      Math.sin(elapsed * 11.7 + 0.8) * 8
      + Math.sin(elapsed * 23.5) * 2.5;
    owner.feedback.drowning.updatePresentation?.({
      pitch,
      yaw,
      roll,
      mouthScale: 1.5 + (Math.sin(elapsed * 15.5) + 1) * 0.22,
    });
  }
}
