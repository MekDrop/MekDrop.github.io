import { Vehicle, Vector3, SeekBehavior } from "yuka";
import { NpcDoorReactionState } from "./NpcDoorReactionState.js";
import { NpcStateMachine } from "./NpcStateMachine.js";
import { NPC_DOOR_AVOIDANCE_PHASE as PHASE } from "../../enum/NpcDoorAvoidancePhase.js";

/**
 * Shared Yuka navigation reaction; door owners retain swing collision.
 */
export class NpcDoorAvoidance {
  /**
   * @type {Set<NpcDoorAvoidance>}
   */
  static #participants = new Set();
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {NpcStateMachine}
   */
  #machine = new NpcStateMachine();
  /**
   * @type {NpcDoorReactionState}
   */
  #reaction;
  /**
   * @type {string}
   */
  #phase = PHASE.IDLE;
  /**
   * @type {Vehicle}
   */
  #vehicle = new Vehicle();
  /**
   * @type {Vector3|null}
   */
  #target = null;
  /**
   * @type {number}
   */
  #remaining = 0;
  /**
   * @type {number}
   */
  #retryRemaining = 0;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {((point: Vector3) => boolean)|null}
   */
  #canMove = null;
  /**
   * @type {((point: Vector3) => boolean)|null}
   */
  #hazard = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #door = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #home = null;
  /**
   * @type {import("playcanvas").Quat|null}
   */
  #homeRotation = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #handle;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #timeHandle;
  /**
   * @type {number}
   */
  #deltaTime = 0;
  /**
   * @param {number} deltaTime
   * @type {(deltaTime: number) => void}
   */
  #captureTime = (deltaTime) => { this.#deltaTime = deltaTime; };
  /**
   * @type {() => void}
   */
  #beforeRender = () => {
    if (this.#machine.currentState === this.#reaction) {
      this.#reaction.execute();
    } else if (this.#home) {
      this.#home = null;
      this.#homeRotation = null;
      this.#target = null;
      this.#door = null;
      this.#phase = PHASE.IDLE;
      this.#onPose?.("resume", this.#elapsed);
    }
  };
  /**
   * @type {((action: string, time: number) => void)|null}
   */
  #onPose;
  /**
   * @type {number}
   */
  #step = 0;

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").AppBase|undefined} app
   * @param {((action: string, time: number) => void)|null} onPose
   */
  constructor(entity, app, onPose = null) {
    this.#entity = entity;
    this.#onPose = onPose;
    this.#vehicle.maxSpeed = 1.4;
    this.#reaction = new NpcDoorReactionState(this.#tickReaction);
    this.#timeHandle = app?.on("update", this.#captureTime) ?? null;
    this.#handle = app?.on("prerender", this.#beforeRender) ?? null;
    NpcDoorAvoidance.#participants.add(this);
    entity.once("destroy", this.destroy, this);
  }

  /**
   * @returns {string}
   */
  get phase() { return this.#phase; }

  /**
   * @returns {NpcStateMachine}
   */
  get behavior() { return this.#machine; }

  /**
   * @param {NpcStateMachine} behavior
   */
  set behavior(behavior) {
    if (behavior === this.#machine) { return; }
    this.#machine.resumeReaction(this.#reaction);
    this.#machine = behavior;
    if (this.#home) { this.#machine.interruptReaction(this.#reaction); }
  }

  /**
   * @type {() => void}
   */
  #tickReaction = () => { this.#update(this.#deltaTime); };

  /**
   * @param {string} phase
   */
  #transition(phase) {
    this.#phase = phase;
    if (phase === PHASE.IDLE) { this.#machine.resumeReaction(this.#reaction); }
    this.#vehicle.velocity.set(0, 0, 0);
    if (phase === PHASE.IDLE || phase === PHASE.WAIT) {
      this.#onPose?.(phase === PHASE.IDLE ? "resume" : "idle", this.#elapsed);
    }
  }

  /**
   * Reserves the entire swing before a door starts moving. Navigation uses the
   * scene's existing collision queries, sampling the whole proposed sidestep.
   * @param {import("playcanvas").Entity} door
   * @param {(point: Vector3) => boolean} inSwing
   * @param {(point: Vector3) => boolean} canMove
   */
  static requestClearance(door, inSwing, canMove) {
    for (const participant of this.#participants) {
      if (participant.#entity.root !== door.root || !participant.#entity.enabled) {
        continue;
      }
      if (participant.#door === door) { participant.#remaining = 0.6; }
      const point = participant.#entity.getPosition();
      if (!inSwing(point)) { continue; }
      if (!participant.#machine.interruptReaction(participant.#reaction)) { continue; }
      participant.#home ??= participant.#entity.getLocalPosition().clone();
      participant.#homeRotation ??= participant.#entity.getLocalRotation().clone();
      participant.#door = door;
      participant.#hazard = inSwing;
      participant.#remaining = 0.6;
      participant.#canMove = canMove;
      if (participant.#target && participant.phase === PHASE.YIELD &&
        !inSwing(participant.#target) && canMove(participant.#target)) {
        continue;
      }
      if (participant.#retryRemaining > 0) { continue; }
      participant.#retryRemaining = 0.25;
      participant.#target = null;
      for (let distance = 0.25; distance <= 3 && !participant.#target; distance += 0.25) {
        for (let direction = 0; direction < 16; direction++) {
          const angle = direction * Math.PI / 8;
          const target = new Vector3(point.x + Math.cos(angle) * distance, point.y,
            point.z + Math.sin(angle) * distance);
          if (inSwing(target)) { continue; }
          let clear = true;
          for (let step = 1; step <= Math.ceil(distance / 0.05); step++) {
            const fraction = Math.min(1, step * 0.05 / distance);
            if (!canMove(new Vector3(point.x + (target.x - point.x) * fraction,
              point.y, point.z + (target.z - point.z) * fraction))) {
              clear = false;
              break;
            }
          }
          if (clear) { participant.#target = target; break; }
        }
      }
      participant.#transition(participant.#target ? PHASE.YIELD : PHASE.WAIT);
    }
  }

  /**
   * @param {import("playcanvas").Entity} door
   * @param {(point: Vector3) => boolean} blocks
   * @returns {boolean}
   */
  static occupied(door, blocks) {
    for (const participant of this.#participants) {
      if (participant.#entity.root === door.root && participant.#entity.enabled &&
        blocks(participant.#entity.getPosition())) { return true; }
    }
    return false;
  }

  /**
   * @param {number} deltaTime
   * @type {(deltaTime: number) => void}
   */
  #update = (deltaTime) => {
    if (!this.#entity.enabled) { return; }
    const step = Math.min(0.05, Math.max(0, deltaTime));
    this.#step = step;
    this.#remaining = Math.max(0, this.#remaining - step);
    this.#retryRemaining = Math.max(0, this.#retryRemaining - step);
    if (!this.#home) { return; }
    if (this.#remaining === 0 && this.phase !== PHASE.RETURN) {
      this.#door = null;
      this.#transition(PHASE.RETURN);
    }
    if (this.phase === PHASE.RETURN) {
      const home = this.#entity.parent.getWorldTransform().transformPoint(this.#home);
      this.#target = new Vector3(home.x, home.y, home.z);
    }
    if (this.phase === PHASE.YIELD || this.phase === PHASE.RETURN) {
      this.advance();
    } else {
      this.hold();
    }
  };

  hold() {
    if (this.phase === PHASE.WAIT) { this.#onPose?.("idle", this.#elapsed); }
  }

  advance() {
    if (!this.#target) { return; }
    const step = this.#step;
    const position = this.#entity.getPosition();
    this.#vehicle.position.set(position.x, position.y, position.z);
    this.#vehicle.steering.clear();
    this.#vehicle.steering.add(new SeekBehavior(this.#target));
    this.#vehicle.update(step);
    const next = this.#vehicle.position;
    if (!this.#canMove?.(next)) {
      if (this.phase === PHASE.RETURN) {
        // Resume the task at the safe sidestep if its old spot remains blocked.
        this.#entity.setLocalRotation(this.#homeRotation);
        this.#home = null;
        this.#homeRotation = null;
        this.#target = null;
        this.#transition(PHASE.IDLE);
        return;
      }
      this.#target = null;
      this.#transition(PHASE.WAIT);
      return;
    }
    this.#entity.setPosition(next.x, position.y, next.z);
    const rotation = this.#vehicle.rotation;
    this.#entity.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
    this.#elapsed += step;
    this.#onPose?.("walk", this.#elapsed);
    if (next.distanceTo(this.#target) < 0.04 &&
      (this.phase === PHASE.RETURN || !this.#hazard?.(next))) {
      if (this.phase === PHASE.RETURN) {
        if (this.#canMove(this.#target)) { this.#entity.setLocalPosition(this.#home); }
        this.#entity.setLocalRotation(this.#homeRotation);
        this.#home = null;
        this.#homeRotation = null;
        this.#target = null;
        this.#transition(PHASE.IDLE);
      } else {
        this.#transition(PHASE.WAIT);
      }
    }
  }

  destroy() {
    this.#handle?.off();
    this.#timeHandle?.off();
    this.#entity.off("destroy", this.destroy, this);
    NpcDoorAvoidance.#participants.delete(this);
    this.#machine.resumeReaction(this.#reaction);
    this.#target = null;
  }
}
