import { State } from "yuka";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { LatchSeekState } from "./LatchSeekState.js";
import { LatchBridgeContact } from "../LatchBridgeContact.js";
import { LatchBankReturn } from "../LatchBankReturn.js";
import { slimeBridgeTransferProgress } from "../../../path/BridgeSlimeTiming.js";

/**
 * A reserved slug reaches the live tissue edge before becoming a living span.
 */
export class LatchBridgeState extends State {
  /**
   * @type {import("../../../path/Bridge.js").Bridge|null}
   */
  bridge = null;
  /**
   * @type {{station:number, position:import("playcanvas").Vec3, approach:import("playcanvas").Vec3, feedApproach?:import("playcanvas").Vec3, settleSeconds?:number, waypoints?:import("playcanvas").Vec3[], supports?:{station:number,entity:import("playcanvas").Entity,position:import("playcanvas").Vec3,start:import("playcanvas").Vec3,end:import("playcanvas").Vec3}[]}|null}
   */
  assignment = null;
  /**
   * @type {number}
   */
  age = 0;
  /**
   * @type {boolean}
   */
  spreading = false;
  /**
   * @type {boolean}
   */
  committed = false;
  /**
   * @type {boolean}
   */
  validating = false;
  /**
   * @type {number|null}
   */
  recoveringAge = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  recoveryBankTarget = null;
  /**
   * @type {LatchBankReturn|null}
   */
  bankReturn = null;
  /**
   * @type {number}
   */
  approachAge = 0;
  /**
   * @type {number}
   */
  stalledAge = 0;
  /**
   * @type {number}
   */
  closestDistance = Infinity;
  /**
   * @type {LatchBridgeContact|null}
   */
  contactLatch = null;
  /**
   * @type {number}
   */
  waypointIndex = 0;
  /**
   * @type {number}
   */
  boundRetryDelay = 0;
  /**
   * @type {boolean}
   */
  returning = false;
  /**
   * @type {NonNullable<LatchBridgeState["assignment"]>["supports"]}
   */
  returnSupports = [];

  /**
   * A capsule's feet trail its real surface attachment. Measure material reach
   * from that attachment, while retaining a bounded, solver-verified capsule.
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @param {LatchBridgeContact} latch
   * @param {NonNullable<LatchBridgeState["assignment"]>} assignment
   * @returns {boolean}
   */
  static reachesPlacement(owner, latch, assignment) {
    const point = latch?.point;
    const front = assignment.supports?.at(-1);
    const edge = assignment.placementEdge;
    if (!point || !latch.constraint || !front || front.entity !== latch.other || !edge ||
      latch.other.up.y < 0.5 || point.distance(edge) > 0.2 ||
      point.distance(assignment.position) > 0.72 ||
      owner.position.distance(point) > owner.radius + 0.55 ||
      owner.position.distance(assignment.position) > 1.4) {
      return false;
    }
    const sourceAnchor = owner.entity.getWorldTransform().transformPoint(latch.extension);

    return sourceAnchor.distance(point) <= 0.12;
  }

  /**
   * @param {NonNullable<LatchBridgeState["assignment"]>["supports"]} supports
   * @param {import("playcanvas").Vec3} [front]
   * @returns {NonNullable<LatchBridgeState["assignment"]>["supports"]}
   */
  #captureReturnSupports(supports, front = this.assignment.approach) {
    const captured = [];
    for (let index = 0; index < supports.length; index++) {
      const support = supports[index];
      const inverse = support.entity?.getWorldTransform?.().clone().invert();
      const previous = supports[index - 1];
      const heading = previous ? previous.position.clone().sub(support.position) :
        support.position.clone().sub(supports[1]?.position ?? front);
      captured.push({
        ...support,
        returnTowardStart: support.start.clone().sub(support.position).dot(heading) > support.end.clone().sub(support.position).dot(heading),
        localPosition: inverse?.transformPoint(support.position),
        localStart: inverse?.transformPoint(support.start),
        localEnd: inverse?.transformPoint(support.end),
        localEntry: support.entry && inverse?.transformPoint(support.entry),
        localExit: support.exit && inverse?.transformPoint(support.exit),
      });
    }

    return captured;
  }

  /**
   * @returns {NonNullable<LatchBridgeState["assignment"]>["supports"]}
   */
  #liveReturnSupports() {
    const result = [];
    for (const support of this.returnSupports) {
      if (!support.localPosition) {
        result.push(support);
        continue;
      }
      if (!support.entity?.rigidbody?.body) {
        continue;
      }
      const transform = support.entity.getWorldTransform();
      const localPosition = support.localPosition.clone();
      const localStart = support.localStart.clone();
      const localEnd = support.localEnd.clone();
      const localEntry = support.localEntry?.clone();
      const localExit = support.localExit?.clone();
      const height = support.entity.collision?.halfExtents?.y;
      if (Number.isFinite(height)) {
        localPosition.y = height;
        localStart.y = height;
        localEnd.y = height;
        if (localEntry) {
          localEntry.y = height;
        }
        if (localExit) {
          localExit.y = height;
        }
      }
      result.push({
        ...support,
        position: transform.transformPoint(localPosition),
        start: transform.transformPoint(localStart),
        end: transform.transformPoint(localEnd),
        entry: localEntry ? transform.transformPoint(localEntry) : support.entry,
        exit: localExit ? transform.transformPoint(localExit) : support.exit,
      });
    }

    return result;
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  #returnBound(owner) {
    if (!this.contactLatch?.point) {
      this.contactLatch?.destroy();
      this.contactLatch = null;
      owner.airborne = true;
      owner.grounded = false;
      if (this.recoveryBankTarget) {
        this.bankReturn = new LatchBankReturn(owner, this.recoveryBankTarget);
        this.recoveryBankTarget = null;

        return;
      }
      owner.releaseRebuildAssignment();

      return;
    }
    const physics = owner.app?.systems?.rigidbody;
    const start = owner.position.clone();
    const end = owner.position.clone();
    start.y += 0.15;
    end.y -= 0.15;
    const hit = physics?.raycastFirst?.(start, end, { filterCallback: LatchBridgeState.#safeSupport });
    if (hit?.entity?.rigidbody?.type === "static" && hit.normal?.y >= 0.9 && owner.position.y - hit.point.y >= -0.03 &&
      owner.position.y - hit.point.y <= 0.12) {
      this.contactLatch.destroy();
      this.contactLatch = null;
      owner.airborne = true;
      owner.grounded = false;
      if (this.recoveryBankTarget && Math.abs(hit.point.y - this.recoveryBankTarget.y) > 0.15) {
        this.bankReturn = new LatchBankReturn(owner, this.recoveryBankTarget);
        this.recoveryBankTarget = null;

        return;
      }
      owner.releaseRebuildAssignment();

      return;
    }
    const supports = this.#liveReturnSupports();
    const index = supports.findIndex(/**
     *
     * @param {{entity:import("playcanvas").Entity}} support
     */
      (support) => support.entity === this.contactLatch.other);
    const support = supports[index];
    if (support) {
      const previous = supports[index - 1];
      const target = support.entry ?? (support.returnTowardStart ? support.start : support.end);
      this.contactLatch.crawl(target, owner.deltaTime);
      if (previous && this.contactLatch.point.distance(target) <= 0.08) {
        const joined = previous.exit ?? (previous.start.distance(target) < previous.end.distance(target) ? previous.start : previous.end);
        if (joined.distance(target) <= 0.2) {
          this.contactLatch.extend(joined, owner.deltaTime);
        }
      }
    }
  }

  /**
   * A dependent worker is already a live physical actor. Keep its real pose
   * and momentum; retreat on its surviving grip or return from actual ground.
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} bankTarget
   */
  cancelApproach(owner, bankTarget) {
    this.recoveryBankTarget = bankTarget.clone();
    this.returnSupports = this.#captureReturnSupports(this.assignment.supports ?? []);
    this.boundRetryDelay = 0;
    this.returning = true;
    this.spreading = false;
    this.age = 0;
    owner.setBridgeMorphScale(1);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #safeSupport(entity) {
    return entity.rigidbody?.type === "static";
  }

  /**
   * A moving front may temporarily withhold its placement while it settles.
   * Keep the verified grip and its exclusive reservation during that pause.
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  #waitForPlacement(owner) {
    if (!this.contactLatch?.point) {
      owner.stop();
    }
    this.stalledAge += owner.deltaTime;
    if (this.stalledAge >= 8) {
      this.#failAndRetry(owner);
    }
  }

  /**
   * Preserve the existing physical grip while a precarious worker retries.
   * Releasing a contact over the gap would turn a timeout into a fall.
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  #failAndRetry(owner) {
    this.returnSupports = this.#captureReturnSupports(this.assignment.supports ?? []);
    this.bridge.failRebuildAttempt?.(this.assignment.station, owner, Boolean(this.contactLatch?.point));
    owner.setBridgeLiquidOwnership?.(false);
    owner.setBridgeMorphScale(1);
    this.spreading = false;
    if (this.contactLatch?.point) {
      this.boundRetryDelay = 15;
      this.age = 0;
      this.approachAge = 0;
      this.stalledAge = 0;
      this.closestDistance = Infinity;

      return;
    }
    owner.stop();
    owner.releaseRebuildAssignment();
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").ContactResult} result
   */
  contact(owner, result) {
    if (this.bankReturn) {
      this.bankReturn.contact(result);

      return;
    }
    if (!this.assignment || this.assignment.staging || this.spreading || !owner.alive || owner.carrier ||
      !result.other?.tags?.has("hero-moving-support")) {
      return;
    }
    const supports = this.returning ? this.returnSupports : this.assignment.supports ?? [];
    const nextIndex = supports.findIndex(/**
     *
     * @param {{entity:import("playcanvas").Entity}} support
     */
      (support) => support.entity === result.other);
    const previousIndex = supports.findIndex(/**
     *
     * @param {{entity:import("playcanvas").Entity}} support
     */
      (support) => support.entity === this.contactLatch?.other);
    const expectedIndex = previousIndex + (this.returning ? -1 : 1);
    if (this.contactLatch?.point && (nextIndex !== expectedIndex || nextIndex < 0)) {
      return;
    }
    for (const contact of result.contacts ?? []) {
      const point = contact.pointOther ?? contact.point;
      const finalContact = point && point.distance(this.assignment.approach) <= 0.6 &&
        owner.position.distance(this.assignment.position) <= 0.95;
      if (point && owner.position.distance(point) <= owner.radius + 0.55 && (nextIndex >= 0 || finalContact)) {
        this.contactLatch?.destroy();
        this.contactLatch = new LatchBridgeContact(owner, result.other, point, true);
        if (this.contactLatch.point) {
          owner.airborne = false;
        }

        return;
      }
    }
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @returns {boolean}
   */
  claim(owner) {
    const bridges = owner.runtime.objects?.getWithMethod?.("reserveRebuildStation") ?? [];
    for (const bridge of bridges) {
      const assignment = bridge.reserveRebuildStation(owner) ?? bridge.reserveRebuildStaging?.(owner);
      if (assignment) {
        this.bridge = bridge;
        this.assignment = assignment;
        this.age = 0;
        this.approachAge = 0;
        this.stalledAge = 0;
        this.closestDistance = Infinity;
        this.waypointIndex = 0;

        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    if (this.bankReturn) {
      const result = this.bankReturn.update(owner.deltaTime);
      owner.playClip(ANIMATION.WADDLE_WALK);
      if (result !== "working") {
        this.bankReturn.destroy();
        this.bankReturn = null;
        owner.airborne = true;
        owner.grounded = false;
        owner.releaseRebuildAssignment();
      }

      return;
    }
    if (this.recoveringAge !== null) {
      this.recoveringAge += owner.deltaTime;
      const progress = Math.min(1, this.recoveringAge / 0.7);
      owner.setBridgeMorphScale(Math.max(0.001, progress * progress * (3 - 2 * progress)));
      if (progress >= 1) {
        owner.setBridgeLiquidOwnership?.(false);
        owner.setBridgeMorphScale(1);
        this.recoveringAge = null;
        this.spreading = false;
        if (this.recoveryBankTarget) {
          this.bankReturn = new LatchBankReturn(owner, this.recoveryBankTarget, { arrivalRadius: this.assignment?.counterweight ? 0.04 : 0.4 });
          this.recoveryBankTarget = null;
        } else {
          owner.releaseRebuildAssignment();
        }
      }

      return;
    }
    if (this.returning && owner.alive && !owner.carrier) {
      this.#returnBound(owner);

      return;
    }
    if (this.boundRetryDelay > 0 && owner.alive && !owner.carrier) {
      if (!this.contactLatch?.point) {
        this.#returnBound(owner);

        return;
      }
      this.boundRetryDelay = Math.max(0, this.boundRetryDelay - owner.deltaTime);
      if (this.boundRetryDelay > 0) {
        return;
      }
      const assignment = this.bridge.reserveRebuildStation(owner);
      if (!assignment) {
        if (this.bridge.rebuildDemand) {
          this.#waitForPlacement(owner);

          return;
        }
        this.returning = true;
        this.#returnBound(owner);

        return;
      }
      this.assignment = assignment;
      this.waypointIndex = 0;
    }
    if (this.spreading) {
      const status = this.bridge?.getRebuildAttemptStatus?.(this.assignment.station, owner) ?? "complete";
      if (status === "failed") {
        if (this.committed || this.validating) {
          const recovery = this.bridge.getRebuildRecovery(this.assignment.station, owner);
          if (recovery) {
            this.committed = false;
            this.validating = false;
            this.recoveringAge = 0;
            this.recoveryBankTarget = recovery.bankTarget?.clone() ?? null;
            owner.recoverBridgeContribution(recovery.position, recovery.velocity);
          }

          return;
        }
        this.#failAndRetry(owner);

        return;
      }
      this.age += owner.deltaTime;
      if (!this.contactLatch?.point) {
        owner.stop();
      }
      const morph = this.bridge?.getRebuildMorphProgress?.(this.assignment.station, owner);
      const nativeAdmitted = morph?.nativeAdmitted ?? (this.validating || this.committed || status === "complete");
      const progress = morph?.progress ?? (nativeAdmitted ? 1 : Math.min(0.999, slimeBridgeTransferProgress(this.age)));
      // Source and destination share one volume progress. Keep a visible source
      // until the authoritative native handoff, then never shrink it a second time.
      owner.setBridgeMorphScale(Math.cbrt(Math.max(0, 1 - progress)));
      if (nativeAdmitted && progress >= 1 && status === "complete" && !this.committed) {
        this.contactLatch?.destroy();
        this.contactLatch = null;
        owner.commitBridgeContribution();
        this.committed = true;
        this.validating = false;
      }

      return;
    }
    if (!this.bridge || !this.assignment || !owner.alive || owner.carrier) {
      owner.behavior.changeTo(LatchSeekState.name);

      return;
    }
    const assignment = this.bridge.reserveRebuildStation(owner);
    if (!assignment) {
      if (this.assignment.staging) {
        const staging = this.bridge.reserveRebuildStaging?.(owner);
        if (staging) {
          this.assignment = staging;
          const distance = Math.hypot(owner.position.x - staging.approach.x, owner.position.z - staging.approach.z);
          if (distance > 0.18) {
            this.approachAge += owner.deltaTime;
            this.stalledAge += owner.deltaTime;
            if (distance < this.closestDistance - 0.1) {
              this.closestDistance = distance;
              this.stalledAge = 0;
            }
            if (owner.peerYield?.receiver || owner.peerYield?.requester) {
              this.stalledAge = 0;
            }
            if (this.stalledAge >= 8 || this.approachAge >= 30) {
              owner.stop();
              owner.releaseRebuildAssignment();

              return;
            }
            owner.playClip(ANIMATION.WADDLE_WALK);
            owner.approachBridge(staging.approach);
          } else {
            this.approachAge = 0;
            this.stalledAge = 0;
            this.closestDistance = Infinity;
            owner.stop();
            owner.playClip(ANIMATION.SIT_LOOP);
          }

          return;
        }
      }
      if (this.contactLatch?.point) {
        if (this.bridge.rebuildDemand) {
          this.#waitForPlacement(owner);

          return;
        }
        this.returnSupports = this.#captureReturnSupports(this.assignment.supports ?? []);
        this.returning = true;
        this.#returnBound(owner);

        return;
      }
      owner.behavior.changeTo(LatchSeekState.name);

      return;
    }
    const previousSupports = this.assignment.supports ?? [];
    const previousApproach = this.assignment.approach;
    this.assignment = assignment;
    if (assignment.feedApproach) {
      this.#feedPool(owner, assignment);

      return;
    }
    const approach = assignment.approach;
    const contactPoint = this.contactLatch?.point;
    const placementDistance = Math.hypot(owner.position.x - assignment.position.x,
      owner.position.y - assignment.position.y, owner.position.z - assignment.position.z);
    const supportedContact = LatchBridgeState.reachesPlacement(owner, this.contactLatch, assignment);
    const supports = assignment.supports ?? [];
    const boundIndex = supports.findIndex(/**
     *
     * @param {{entity:import("playcanvas").Entity}} support
     */
      (support) => support.entity === this.contactLatch?.other);
    if (contactPoint && boundIndex < 0 && !supportedContact) {
      if (!this.returnSupports.length) {
        this.returnSupports = this.#captureReturnSupports(previousSupports, previousApproach);
      }
      this.returning = true;
      this.#returnBound(owner);

      return;
    }
    const waypoints = assignment.waypoints ?? [];
    while (this.waypointIndex < waypoints.length && (owner.grounded || boundIndex >= this.waypointIndex) && !owner.airborne &&
      owner.position.distance(waypoints[this.waypointIndex]) <= 0.75) {
      this.waypointIndex++;
      this.closestDistance = Infinity;
      this.stalledAge = 0;
    }
    const next = waypoints[this.waypointIndex] ?? approach;
    const remaining = Math.hypot(owner.position.x - next.x, owner.position.y - next.y,
      owner.position.z - next.z);
    this.approachAge += owner.deltaTime;
    this.stalledAge += owner.deltaTime;
    if (remaining < this.closestDistance - 0.15) {
      this.closestDistance = remaining;
      this.stalledAge = 0;
    }
    if (owner.peerYield?.receiver || owner.peerYield?.requester) {
      this.stalledAge = 0;
    }
    // A changing or inaccessible physical tip must not hold a reservation
    // forever. The owner's retry delay lets another worker try after release.
    if (this.stalledAge >= 8 || this.approachAge >= 60) {
      if (!this.contactLatch?.point) {
        // Waiting for an unobstructed bank approach is not a failed physical
        // placement and must not distort the next donor's shape or counters.
        owner.stop();
        owner.releaseRebuildAssignment();

        return;
      }
      this.#failAndRetry(owner);

      return;
    }
    const firstBankContact = !this.contactLatch && supports.length === 0 &&
      Math.hypot(owner.position.x - approach.x, owner.position.z - approach.z) <= 0.6 &&
      placementDistance <= 0.95 && Math.abs(owner.position.y - approach.y) <= 0.4 &&
      owner.grounded && !owner.airborne;
    if (!supportedContact && !firstBankContact) {
      this.age = 0;
      owner.playClip(ANIMATION.WADDLE_WALK);
      if (contactPoint && boundIndex >= 0) {
        const support = supports[boundIndex];
        const following = supports[boundIndex + 1];
        const heading = (following?.position ?? approach).clone().sub(support.position);
        const startDistance = support.start.clone().sub(support.position).dot(heading);
        const endDistance = support.end.clone().sub(support.position).dot(heading);
        const target = following ? support.exit ?? (startDistance > endDistance ? support.start : support.end) :
          assignment.placementEdge ?? support.exit ?? (startDistance > endDistance ? support.start : support.end);
        this.contactLatch.crawl(target, owner.deltaTime);
        if (following && this.contactLatch.point.distance(target) <= 0.08) {
          const start = following.start.distance(target);
          const end = following.end.distance(target);
          const joined = following.entry ?? (start < end ? following.start : following.end);
          if (joined.distance(target) <= 0.2) {
            this.contactLatch.extend(joined, owner.deltaTime);
          }
        }
      } else {
        owner.approachBridge(next);
      }

      return;
    }
    if (!this.contactLatch?.point) {
      owner.stop();
      owner.faceTarget({ position: this.assignment.position });
    }
    owner.playClip(ANIMATION.IDLE_DOG);
    this.age += owner.deltaTime;
    if (this.age >= (assignment.settleSeconds ?? 1.1)) {
      if (this.bridge.restoreSlimeStation(this.assignment.station, owner)) {
        this.spreading = true;
        this.age = 0;
      } else {
        owner.behavior.changeTo(LatchSeekState.name);
      }
    }
  }

  /**
   * A supported bank reservoir accepts each new individual at its real shore
   * contact. The existing receiving skin carries that individual's conserved
   * volume along the gel into the next tile; no capsule walks a growing pool.
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @param {NonNullable<LatchBridgeState["assignment"]>} assignment
   */
  #feedPool(owner, assignment) {
    const target = assignment.feedApproach;
    const distance = Math.hypot(owner.position.x - target.x, owner.position.z - target.z);
    const grounded = owner.grounded && !owner.airborne &&
      owner.isBridgeApproachingFromGround?.(this.bridge, assignment.station) !== false;
    if (distance > 0.18 || !grounded) {
      this.age = 0;
      this.approachAge += owner.deltaTime;
      this.stalledAge += owner.deltaTime;
      if (distance < this.closestDistance - 0.1) {
        this.closestDistance = distance;
        this.stalledAge = 0;
      }
      if (owner.peerYield?.receiver || owner.peerYield?.requester) {
        this.stalledAge = 0;
      }
      if (this.stalledAge >= 8 || this.approachAge >= 60) {
        owner.stop();
        owner.releaseRebuildAssignment();

        return;
      }
      owner.playClip(ANIMATION.WADDLE_WALK);
      owner.approachBridge(target);

      return;
    }
    owner.stop();
    owner.playClip(ANIMATION.IDLE_DOG);
    this.age += owner.deltaTime;
    if (this.age >= (assignment.settleSeconds ?? 1.1)) {
      if (this.bridge.restoreSlimeStation(assignment.station, owner)) {
        this.spreading = true;
        this.age = 0;
      } else {
        owner.releaseRebuildAssignment();
      }
    }
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  exit(owner) {
    owner.setBridgeLiquidOwnership?.(false);
    this.bankReturn?.destroy();
    this.bankReturn = null;
    if (this.spreading && this.bridge && this.assignment &&
      this.bridge.getRebuildAttemptStatus?.(this.assignment.station, owner) === "growing") {
      this.bridge.failRebuildAttempt(this.assignment.station, owner);
      owner.setBridgeMorphScale(1);
    }
    this.contactLatch?.destroy();
    this.contactLatch = null;
    this.bridge?.releaseRebuildStation(owner);
    this.bridge = null;
    this.assignment = null;
    this.age = 0;
    this.spreading = false;
    this.committed = false;
    this.validating = false;
    this.recoveringAge = null;
    this.recoveryBankTarget = null;
    this.approachAge = 0;
    this.stalledAge = 0;
    this.closestDistance = Infinity;
    this.waypointIndex = 0;
    this.boundRetryDelay = 0;
    this.returning = false;
    this.returnSupports = [];
  }
}
