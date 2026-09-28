import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";
import { TERRACE_DOOR_INSPECTION_PHASE as INSPECTION } from "../../enum/TerraceDoorInspectionPhase.js";
import { TerraceDoor } from "./TerraceDoor.js";
import { TerraceDoorInspection } from "./TerraceDoorInspection.js";
import { TerraceInspectorWalk } from "./TerraceInspectorWalk.js";

const DOORWAY_POSITION_Z = -0.25;
const DOORWAY_START_Z = -1.4;
const DOORWAY_VISIBLE_Z = 0.2;
const ease = (value) => value * value * (3 - 2 * value);

/**
 * Owns door interaction and executes the inspector's Yuka-state presentation.
 */
export class TerraceDoorActions {
  static get modelUrls() {
    return TerraceDoor.modelUrls;
  }

  #pc;
  #root;
  #stage;
  #door;
  #inspection = new TerraceDoorInspection();
  #inspector;
  #canInspect;

  constructor({
    pc,
    modelLibrary,
    wallMaterial,
    woodMaterial,
    root,
    stage,
    scale,
    inspector,
    canInspect,
  }) {
    this.#pc = pc;
    this.#root = root;
    this.#stage = stage;
    this.#canInspect = canInspect;
    this.#door = new TerraceDoor({
      pc,
      modelLibrary,
      wallMaterial,
      woodMaterial,
      onOpen: () => this.#canInspect() && this.#inspection.start(),
    });
    this.#door.entity.setLocalPosition(0, 0, DOORWAY_POSITION_Z);
    root.addChild(this.#door.entity);
    this.#inspector = inspector;
    this.#inspector.entity.name = "Terrace door inspecting servant";
    this.#inspector.entity.setLocalScale(scale, scale, scale);
    this.#inspector.entity.enabled = false;
  }

  get inspecting() {
    return this.#inspection.inspecting;
  }

  get state() {
    return {
      openAmount: this.#door.openAmount,
      inspectionPhase: this.#inspection.phase,
      inspectionAnimation: this.#inspection.animation,
      inspectorVisible: this.#inspector.entity.enabled,
      handleGripDistance:
        this.#inspection.phase === INSPECTION.CLOSE
          ? this.#inspector.rightHand
              .getPosition()
              .distance(this.#door.insideHandle.getPosition())
          : null,
    };
  }

  update(deltaTime, participantPhase) {
    const traffic = [
      PHASE.SERVANT_ENTER,
      PHASE.SERVANT_EXIT,
      PHASE.ROYAL_ENTER,
      PHASE.ROYAL_EXIT,
      PHASE.SERVANT_RETURN,
      PHASE.SERVANT_LEAVE,
    ].includes(participantPhase);
    this.#inspection.update(
      deltaTime,
      ![PHASE.DORMANT, PHASE.ACTIVITY].includes(participantPhase),
    );
    if (this.#inspection.phase === INSPECTION.CLOSE) {
      this.#door.openAmount = 1 - ease(this.#inspection.progress);
    } else {
      this.#door.update(
        deltaTime,
        traffic || this.#inspection.doorOpen,
        this.#inspection.phase === INSPECTION.WAIT && !traffic ? 0.65 : 3,
      );
    }
    this.#syncInspector();
  }

  getPointerHit(rayStart, rayEnd) {
    return this.#door.getPointerHit(rayStart, rayEnd);
  }

  blocksCameraAt(x, y, z, radius = 0) {
    return this.#door.blocksCameraAt(x, y, z, radius);
  }

  stop() {
    this.#inspection.reset();
    this.#inspector.entity.enabled = false;
    this.#door.update(1, false);
  }

  destroy() {
    this.#inspection.reset();
    this.#inspector.entity.enabled = false;
    this.#inspector = null;
    this.#door.destroy();
  }

  #syncInspector() {
    const phase = this.#inspection.phase;
    const progress = this.#inspection.progress;
    const turn = ease(Math.min(1, progress * 2));
    let z = 1.6;
    let yaw = 0;
    let animation = this.#inspection.animation ?? "idle";
    let animationTime = this.#inspection.elapsed;
    if (phase === INSPECTION.NOTICE) {
      z = DOORWAY_START_Z;
    } else if (phase === INSPECTION.WALK_OUT) {
      const motion = TerraceInspectorWalk.sample({
        start: { x: 0, y: 0, z: DOORWAY_START_Z },
        end: { x: 0, y: 0, z: 1.6 },
        startYaw: 0,
        endYaw: 0,
        elapsed: this.#inspection.elapsed,
        duration: 3,
        scale: 1,
      });
      z = motion.z;
      animation = motion.action === "walk" ? animation : motion.action;
      animationTime = motion.animationTime;
    } else if (phase === INSPECTION.LOOK_LEFT) {
      yaw = -90 * turn;
      animation = progress < 0.5 ? animation : "idle";
      animationTime = Math.min(1, progress * 2);
    } else if (phase === INSPECTION.LOOK_RIGHT) {
      yaw = -90 + 180 * turn;
      animation = progress < 0.5 ? animation : "idle";
      animationTime = Math.min(1, progress * 2);
    } else if (
      [
        INSPECTION.RETURN,
        INSPECTION.GRASP,
        INSPECTION.CLOSE,
        INSPECTION.RELEASE,
        INSPECTION.LEAVE,
      ].includes(phase)
    ) {
      this.#syncInspectorClosing();
      return;
    }
    const stairProgress = ease(
      Math.max(0, Math.min(1, (z - DOORWAY_START_Z) / 1.5)),
    );
    const scale = this.#stage.getLocalScale().x;
    this.#inspector.entity.setLocalPosition(
      0,
      -1.05 * (1 - stairProgress) * scale,
      z * scale,
    );
    this.#inspector.entity.setLocalEulerAngles(0, yaw, 0);
    this.#inspector.entity.enabled =
      this.#inspection.inspecting && z > DOORWAY_VISIBLE_Z;
    this.#inspector.pose(animation, animationTime);
  }

  #syncInspectorClosing() {
    const phase = this.#inspection.phase;
    const progress = this.#inspection.progress;
    const actor = this.#inspector;
    const scale = this.#stage.getLocalScale().x;
    const time = phase === INSPECTION.CLOSE ? 0.7 + 2 * progress : 0.7;
    actor.pose(this.#inspection.alignmentAnimation, time);
    actor.evaluatePose();
    actor.entity.setRotation(this.#door.hingeRotation);
    const offset = this.#door.insideHandle
      .getPosition()
      .clone()
      .sub(actor.rightHand.getPosition());
    actor.entity.setPosition(actor.entity.getPosition().clone().add(offset));
    const gripPosition = actor.entity.getLocalPosition().clone();
    if (phase === INSPECTION.RETURN) {
      const forward = this.#door.hingeRotation.transformVector(
        new this.#pc.Vec3(0, 0, 1),
      );
      this.#root
        .getWorldTransform()
        .clone()
        .invert()
        .transformVector(forward, forward);
      const motion = TerraceInspectorWalk.sample({
        start: { x: 0, y: 0, z: 1.6 * scale },
        end: gripPosition,
        startYaw: 90,
        endYaw: (Math.atan2(forward.x, forward.z) * 180) / Math.PI,
        elapsed: this.#inspection.elapsed,
        duration: 2,
        scale,
      });
      actor.entity.setLocalPosition(motion.x, motion.y, motion.z);
      actor.entity.setLocalEulerAngles(0, motion.yaw, 0);
      actor.pose(
        motion.action === "walk" ? this.#inspection.animation : motion.action,
        motion.animationTime,
      );
    } else if (phase === INSPECTION.GRASP) {
      actor.pose(this.#inspection.animation, 0.7 * progress);
    } else if (phase === INSPECTION.RELEASE) {
      actor.pose(this.#inspection.animation, 2.7 + 0.5 * progress);
    } else if (phase === INSPECTION.LEAVE) {
      const motion = TerraceInspectorWalk.sample({
        start: gripPosition,
        end: { x: 0, y: -1.05 * scale, z: DOORWAY_START_Z * scale },
        startYaw: 0,
        endYaw: 180,
        elapsed: this.#inspection.elapsed,
        duration: 1.8,
        scale,
      });
      actor.entity.setLocalPosition(motion.x, motion.y, motion.z);
      actor.entity.setLocalEulerAngles(0, motion.yaw, 0);
      actor.pose(
        motion.action === "walk" ? this.#inspection.animation : motion.action,
        motion.animationTime,
      );
    }
    actor.entity.enabled = phase !== INSPECTION.LEAVE || progress < 0.95;
    actor.evaluatePose();
  }
}
