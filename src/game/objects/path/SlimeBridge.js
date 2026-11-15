import { BridgeCounterweightPool } from "./BridgeCounterweightPool.js";
import { BridgeSlimeArtwork } from "./BridgeSlimeArtwork.js";
import { BridgeGelLoads } from "./BridgeGelLoads.js";
import { BridgeSlimePhysics } from "./BridgeSlimePhysics.js";
import { BridgeStagingQueue } from "./BridgeStagingQueue.js";
import { captureSlimeRecovery } from "./BridgeSlimeRecovery.js";
import { hasBridgeBankSupport } from "./BridgeBankSupport.js";
import { SLIME_BRIDGE_GROWTH_SECONDS, slimeBridgeTransferProgress } from "./BridgeSlimeTiming.js";
import { BridgeProfile } from "./BridgeProfile.js";
import { WalkingPaths } from "../../navigation/WalkingPaths.js";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
/**
 * @typedef {{direction:number,position:import("playcanvas").Vec2,elevation:number,count:number}} BridgeRebuildBank
 * @typedef {{creature:string,count:number,position:import("playcanvas").Vec2,banks?:BridgeRebuildBank[]}} BridgeRebuildDemand
 */

/**
 * Living replacement span owned by a destructible bridge. Owns donor admission,
 * native slime bodies, support publication, and its independently disposable art.
 */
export class SlimeBridge {
  /**
   * @type {import("./Bridge.js").Bridge}
   */
  #bridge;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #models;
  /**
   * @type {import("../ObjectTypes.js").MapObjectRuntime}
   */
  #runtime;
  /**
   * @type {() => void}
   */
  #rebuildBridge;
  /**
   * @type {() => boolean}
   */
  #collapsing;
  /**
   * @type {number}
   */
  #islandOffset = 0;
  /**
   * @type {number[]}
   */
  #islandOffsets = [];
  /**
   * @type {boolean}
   */
  #floating;
  /**
   * @type {BridgeSlimeArtwork|null}
   */
  #slimeDeck = null;
  /**
   * @type {BridgeGelLoads}
   */
  #gelReaction = new BridgeGelLoads();
  /**
   * @type {BridgeSlimePhysics}
   */
  #slimePhysics;
  /**
   * @type {Map<number, import("../enemies/latch-slug/LatchSlug.js").LatchSlug>}
   */
  #rebuildReservations = new Map();
  /**
   * @type {Map<number,number>}
   */
  #reservationDirections = new Map();
  /**
   * @type {BridgeStagingQueue}
   */
  #stagedContributors = new BridgeStagingQueue();
  /**
   * @type {BridgeCounterweightPool}
   */
  #counterweights = new BridgeCounterweightPool();
  /**
   * The first physical claim chooses the shore for this construction run.
   * @type {number|null}
   */
  #originDirection = null;
  /**
   * @type {Map<number,number>}
   */
  #supportFailures = new Map();
  /**
   * @type {Map<import("../enemies/latch-slug/LatchSlug.js").LatchSlug,import("playcanvas").Vec3>}
   */
  #counterweightReturnTargets = new Map();
  /**
   * @type {Map<number, {age:number,source:import("playcanvas").Vec3}>}
   */
  #growingStations = new Map();
  /**
   * @type {Map<number, {owner:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,status:string,age:number,stableAge?:number,admissionFrame?:boolean}>}
   */
  #rebuildAttempts = new Map();
  /**
   * @type {Map<number,number>}
   */
  #placementFailures = new Map();
  /**
   * @type {Set<number>}
   */
  #heldRetryReservations = new Set();
  /**
   * @type {Map<number,{owner:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,position:import("playcanvas").Vec3,velocity:import("playcanvas").Vec3,bankTarget:import("playcanvas").Vec3}>}
   */
  #rebuildRecoveries = new Map();
  /**
   * @type {boolean}
   */
  #destroying = false;
  /**
   * Remaining living deck sections, including sections claimed by active slugs.
   * @returns {BridgeRebuildDemand|null}
   */
  get rebuildDemand() {
    const { span } = this.definition;
    if (this.#collapsing() || span.cells.every(this.#hasLowerPath.bind(this))) {
      return null;
    }
    let count = 0;
    let donating = 0;
    let nearCount = 0;
    let farCount = 0;
    for (let station = span.start; station <= span.end; station++) {
      const pending = this.#rebuildAttempts.get(station)?.status === "growing";
      count += Number(!this.isIntact(station) || pending);
      donating += Number(pending);
      if (!this.isIntact(station) && !pending) {
        if (station <= (span.start + span.end) / 2) {
          nearCount++;
        } else {
          farCount++;
        }
      }
    }
    const center = this.stationPosition((span.start + span.end) / 2);

    return count ? {
      creature: "LatchSlug",
      count: count - donating,
      position: new this.#pc.Vec2(center.x, center.z),
      banks: [this.#rebuildBank(-1, this.#originDirection ? count - donating : nearCount),
        this.#rebuildBank(1, this.#originDirection ? count - donating : farCount)].filter(Boolean),
    } : null;
  }

  /**
   * Optional dispatch hints never restrict a worker's physical construction side.
   * @param {number} direction
   * @param {number} count
   * @returns {BridgeRebuildBank|null}
   */
  #rebuildBank(direction, count) {
    if (this.#originDirection !== null && direction !== this.#originDirection) {
      return null;
    }
    const { span } = this.definition;
    const station = direction < 0 ? span.start - 1 : span.end + 1;
    if (!this.#isSlimeAnchor(station)) {
      return null;
    }
    const position = this.stationPosition(station);

    return {
      direction,
      position: new this.#pc.Vec2(position.x, position.z),
      elevation: position.y,
      count,
    };
  }

  /**
   * @param {import("../ObjectTypes.js").GridPoint} cell
   * @returns {boolean}
   */
  #hasLowerPath(cell) {
    return this.#runtime.mapData.tileMeta[cell.row][cell.col].bridgeGroundPath === true;
  }

  /**
   * Claim a section nearest the slug, keeping workers from merging into one part.
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{station:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3}|null}
   */
  reserveRebuildStation(slug) {
    const poolAssignment = this.#counterweights.assignment(slug);
    if (poolAssignment) {
      return poolAssignment;
    }
    if (!this.rebuildDemand) {
      return null;
    }
    let closest = null;
    let distance = Infinity;
    const { span } = this.definition;
    for (let station = span.start; station <= span.end; station++) {
      const reservation = this.#rebuildReservations.get(station);
      if (reservation === slug) {
        const direction = this.#reservationDirections.get(station);
        if (!direction) {
          this.#rebuildReservations.delete(station);
          this.#reservationDirections.delete(station);
          continue;
        }
        const bankStation = direction < 0 ? span.start - 1 : span.end + 1;
        if (this.#requiredCounterweights(direction) > (this.#counterweights.masses.get(bankStation) ?? 0)) {
          return null;
        }
        const continuing = slug.isBridgeBoundTo?.(this.#bridge, station) === true ||
          slug.isBridgeApproachingFromGround?.(this.#bridge, station) === true;
        if (!this.#constructionChainReady(station, direction, continuing)) {
          return null;
        }

        this.#heldRetryReservations.delete(station);

        return this.#rebuildPlacement(station, direction);
      }
      if (this.isIntact(station) || reservation || this.#growingStations.has(station)) {
        continue;
      }
      const direction = this.#rebuildApproachDirection(station, slug.position);
      if (direction === null || !this.#stagedContributors.canPromote(direction, slug)) {
        continue;
      }
      if (this.#requiredCounterweights(direction) > (this.#counterweights.masses.get(direction < 0 ? span.start - 1 : span.end + 1) ?? 0)) {
        continue;
      }
      const placement = this.#rebuildPlacement(station, direction);
      if (!placement) {
        continue;
      }
      const candidate = placement.approach.distance(slug.position);
      if (candidate < distance) {
        closest = placement;
        distance = candidate;
      }
    }
    if (closest) {
      this.#originDirection ??= closest.direction;
      this.#rebuildReservations.set(closest.station, slug);
      this.#reservationDirections.set(closest.station, closest.direction);
      this.#stagedContributors.release(slug);
    }
    return closest;
  }

  /**
   * Stage the next worker on real bank terrain while its predecessor forms.
   * This owns a queue position, never a missing or provisional deck section.
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{station:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3,staging:boolean,direction:number}|null}
   */
  reserveRebuildStaging(slug) {
    const existing = this.#counterweights.assignment(slug);
    if (existing) {
      return existing;
    }
    const { span } = this.definition;
    const center = this.stationPosition((span.start + span.end) / 2);
    const direction = (span.horizontal ? slug.position.x <= center.x : slug.position.z <= center.z) ? -1 : 1;
    if (this.#originDirection !== null && direction !== this.#originDirection) {
      return null;
    }
    const station = direction < 0 ? span.start - 1 : span.end + 1;
    const bank = this.stationPosition(station);
    if (this.rebuildDemand && this.#isSlimeAnchor(station) && Math.abs(slug.position.y - bank.y) <= 0.65 &&
      this.#requiredCounterweights(direction) > this.#counterweights.count(direction)) {
      this.#originDirection ??= direction;
      this.#stagedContributors.release(slug);

      return this.#counterweights.reserve(slug, direction, station, bank, span.horizontal);
    }
    if (!this.rebuildDemand) {
      return null;
    }
    return this.#stagedContributors.reserve(slug, {
      span: this.definition.span,
      stationPosition: this.stationPosition.bind(this),
      isReady: this.#constructionReady.bind(this),
      reservationOwner: this.#rebuildReservations.get.bind(this.#rebuildReservations),
    });
  }

  /**
   * Forecast the next worker's gravitational moment about the adhesive bank.
   * The same three-body-length muscle lever is used by the native patch torque
   * cap. Reserve finite bank gel before asking another actor onto that lever.
   * @param {number} direction
   * @returns {number}
   */
  #requiredCounterweights(direction) {
    if (this.#slimePhysics.connected) {
      return 0;
    }
    if (this.#collapsing()) {
      return 1;
    }
    const { span } = this.definition;
    let count = 0;
    let station = direction < 0 ? span.start : span.end;
    while (station >= span.start && station <= span.end && this.isIntact(station)) {
      if (!this.#stationCells(station).some(this.#isSlimeCell.bind(this))) {
        return 0;
      }
      count++;
      station -= direction;
    }
    if (!count) {
      return 1;
    }
    // Fund the post-extension component before admitting the next donor.
    // Waiting until after that extension can let its thin predecessor fail
    // before the additional support actor has reached the bank pool.
    // This is an admission budget only; Ammo still decides contact and motion.
    const nextCount = count + 1;
    const moment = nextCount * nextCount / 2 + nextCount;

    const failures = this.#supportFailures.get(direction) ?? 0;
    // Native evidence requests batches sized by the span's actual load moment.
    // Repeated failed estimates grow progressively (1, 3, 6... batches), so a
    // long unsupported span is never limited to one arbitrary extra helper.
    const reinforcement = Math.max(2, Math.ceil(moment / 6)) * failures * (failures + 1) / 2;

    return Math.max(1, Math.ceil(moment / 3) - 1) + reinforcement;
  }

  /**
   * A worker can only build from its own bank through already settled sections.
   * @param {number} station
   * @param {import("playcanvas").Vec3} position
   * @returns {number|null}
   */
  #rebuildApproachDirection(station, position) {
    const { span } = this.definition;
    const map = this.#runtime.mapData;
    const along = span.horizontal ? position.x + (map.cols - 1) / 2 : position.z + (map.rows - 1) / 2;
    const direction = along <= station ? -1 : 1;
    if (this.#originDirection !== null && direction !== this.#originDirection) {
      return null;
    }
    const bank = this.stationPosition(direction < 0 ? span.start - 1 : span.end + 1);
    const support = this.#slimePhysics.surfaceHeightAt?.(position.x, position.z, 0.1, position.y + 0.35);
    if (Math.abs(position.y - bank.y) > 0.65 &&
      (support == null || Math.abs(position.y - support) > 0.35)) {
      return null;
    }
    const approach = station + direction;
    const current = Math.max(span.start - 1, Math.min(span.end + 1, Math.round(along)));
    for (let candidate = approach; direction < 0 ? candidate >= current : candidate <= current; candidate += direction) {
      if (candidate >= span.start && candidate <= span.end && !this.#constructionReady(candidate)) {
        return null;
      }
    }

    return this.#constructionChainReady(station, direction) ? direction : null;
  }

  /**
   * @param {number} station
   * @param {boolean} allowMotion
   * @returns {boolean}
   */
  #constructionReady(station, allowMotion = false) {
    const attempt = this.#rebuildAttempts.get(station);
    const living = this.#stationCells(station).some(this.#isSlimeCell.bind(this));

    return this.isIntact(station) && attempt?.status !== "growing" &&
      (!attempt && !living || (allowMotion ? this.#slimePhysics.isTraversalSafe(station) :
        this.#slimePhysics.isLoadReady(station)));
  }

  /**
   * Retained grip direction follows the completed bank chain, even when a live
   * body has moved across its original map-cell coordinate.
   * @param {number} station
   * @param {number} direction
   * @param {boolean} allowMotion
   * @returns {boolean}
   */
  #constructionChainReady(station, direction, allowMotion = false) {
    const { span } = this.definition;
    for (let candidate = station + direction; candidate >= span.start && candidate <= span.end; candidate += direction) {
      if (!this.#constructionReady(candidate, allowMotion)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Use the real moving front, not the original bank, as the next placement.
   * @param {number} station
   * @param {number} direction
   * @returns {{station:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3}|null}
   */
  #rebuildPlacement(station, direction) {
    const adjacent = station + direction;
    const failures = this.#placementFailures.get(station) ?? 0;
    const pose = this.#slimePhysics.getPose(adjacent);
    if (pose) {
      if (!this.#slimePhysics.isPreparationComplete(adjacent, -direction)) {
        return null;
      }
      const edge = (direction < 0 ? pose.end : pose.start).clone();
      const reach = edge.clone().sub(pose.position);
      const forwardReach = (this.definition.span.horizontal ? reach.x : reach.z) * -direction;
      // A folded local exit is still the physical joint exit. Wait for native
      // reshaping rather than donating backward or swapping onto the bank pin.
      if (forwardReach <= 0.1) {
        return null;
      }
      const waypoints = [];
      const supports = [];
      let cursor = adjacent;
      let current = pose;
      while (current) {
        waypoints.push(current.position.clone());
        supports.push({
          station: cursor,
          entity: this.#slimePhysics.getEntity(cursor),
          position: current.position.clone(),
          start: current.start.clone(),
          end: current.end.clone(),
          entry: (direction < 0 ? current.start : current.end).clone(),
          exit: (direction < 0 ? current.end : current.start).clone(),
        });
        cursor += direction;
        current = this.#slimePhysics.getPose(cursor);
      }
      waypoints.reverse();
      supports.reverse();

      const bankStation = direction < 0 ? this.definition.span.start - 1 : this.definition.span.end + 1;
      const feedApproach = this.#counterweights.masses.has(bankStation) ? this.stationPosition(bankStation) : null;
      if (feedApproach) {
        feedApproach[this.definition.span.horizontal ? "x" : "z"] += direction * 0.95;
      }

      return {
        station,
        direction,
        feedApproach,
        placementEdge: edge.clone(),
        position: edge.clone().add(reach),
        approach: edge.sub(reach.mulScalar(Math.min(0.8, 0.3 + failures * 0.15))),
        waypoints,
        supports,
        attempt: failures + 1,
        settleSeconds: 1.1 + Math.min(2, failures * 0.5),
      };
    }
    const bank = this.stationPosition(adjacent);
    const destination = this.stationPosition(station);

    return {
      station,
      direction,
      position: destination,
      approach: bank.clone().lerp(bank, destination, 0.35),
      attempt: failures + 1,
      settleSeconds: 1.1 + Math.min(2, failures * 0.5),
    };
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   */
  releaseRebuildStation(slug) {
    this.#counterweightReturnTargets.delete(slug);
    const poolStatus = this.#counterweights.status(slug);
    if (poolStatus && this.#counterweights.release(slug) && !this.#destroying) {
      this.#syncSlimePhysics();
    }
    this.#stagedContributors.release(slug);
    for (const [station, owner] of this.#rebuildReservations) {
      if (owner === slug) {
        this.#rebuildReservations.delete(station);
        this.#reservationDirections.delete(station);
        this.#heldRetryReservations.delete(station);
      }
    }
    for (const [station, attempt] of this.#rebuildAttempts) {
      if (attempt.owner === slug && attempt.status === "failed") {
        this.#rebuildAttempts.delete(station);
        this.#reservationDirections.delete(station);
        this.#rebuildRecoveries.delete(station);
      }
    }
  }

  /**
   * Admit a settled worker as a real two-lane terrain surface.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {boolean}
   */
  restoreSlimeStation(station, slug) {
    if (this.#counterweights.assignment(slug)?.station === station) {
      return this.#counterweights.begin(slug);
    }
    if (!this.rebuildDemand || this.isIntact(station) || this.#rebuildReservations.get(station) !== slug) {
      return false;
    }
    this.#rebuildRecoveries.delete(station);
    this.#rebuildReservations.delete(station);
    // Preserve the bank side while native placement is assessed. Failed bound
    // donations can retry without choosing a different side of the moving tip.
    this.#rebuildAttempts.set(station, {
      owner: slug,
      status: "growing",
      age: 0,
    });
    this.#growingStations.set(station, {
      age: 0,
      source: slug.position.clone(),
      bankFeed: true,
    });
    this.#rebuildBridge();

    return true;
  }

  /**
   * Reserve a clear real shore destination before material becomes a capsule.
   * Its source remains the native pool lip; the recovered actor walks there
   * under native control, rather than being placed at the reserved destination.
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {number} station
   * @returns {boolean}
   */
  #prepareCounterweightReturn(owner, station) {
    const recovery = this.getRebuildRecovery(station, owner);
    const radius = owner.radius ?? 0.42;
    const clearance = radius * 2 + 0.18;
    if (!recovery || !this.#shoreSpaceClear(recovery.position, owner, clearance)) {
      return false;
    }
    if (this.#counterweightReturnTargets.has(owner)) {
      return true;
    }
    const bank = this.stationPosition(station);
    const direction = station < this.definition.span.start ? -1 : 1;
    const along = this.definition.span.horizontal ? "x" : "z";
    const across = this.definition.span.horizontal ? "z" : "x";
    const step = radius * 2 + 0.16;
    for (let depth = 0; depth < 4; depth++) {
      for (const side of [-1, 1, 0]) {
        const target = bank.clone();
        target[along] += direction * (1.05 + depth * step);
        target[across] += side * (step + 0.05);
        if (Math.hypot(target.x - recovery.position.x, target.z - recovery.position.z) < clearance ||
          !this.#shoreSpaceClear(target, owner, radius * 2 + 0.1)) {
          continue;
        }
        let reserved = false;
        for (const position of this.#counterweightReturnTargets.values()) {
          reserved ||= Math.hypot(position.x - target.x, position.z - target.z) < step * 0.98;
        }
        if (reserved || !this.#standingShore(target, radius)) {
          continue;
        }
        this.#counterweightReturnTargets.set(owner, target);

        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {number} clearance
   * @returns {boolean}
   */
  #shoreSpaceClear(point, owner, clearance) {
    for (const actor of this.#runtime.objects ?? []) {
      if (actor === owner || actor.alive === false || actor.isBridgeCommitted || !actor.entity?.enabled ||
        !actor.entity.rigidbody?.enabled || actor.entity.rigidbody.type === "static") {
        continue;
      }
      const position = actor.entity.getPosition();
      const height = Math.max(owner.height ?? 1, actor.height ?? actor.entity.collision?.height ?? 1);
      const spacing = Math.max(clearance, (owner.radius ?? 0.42) + (actor.radius ?? 0.42) + 0.1);
      if (Math.abs(position.y - point.y) < height &&
        Math.hypot(position.x - point.x, position.z - point.z) < spacing) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {number} radius
   * @returns {boolean}
   */
  #standingShore(point, radius) {
    const physics = this.#app.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return false;
    }
    const samples = [new this.#pc.Vec2(), new this.#pc.Vec2(radius, 0),
      new this.#pc.Vec2(-radius, 0), new this.#pc.Vec2(0, radius), new this.#pc.Vec2(0, -radius)];
    for (const offset of samples) {
      const from = new this.#pc.Vec3(point.x + offset.x, point.y + 0.3, point.z + offset.y);
      const to = new this.#pc.Vec3(from.x, point.y - 0.3, from.z);
      const hit = physics.raycastFirst(from, to, { filterCollisionMask: this.#pc.BODYGROUP_STATIC });
      if (!hit || hit.normal?.y < 0.8 || Math.abs(hit.point.y - point.y) > 0.15) {
        return false;
      }
    }

    return true;
  }

  /**
   * Keep the original donor until its admitted physical mass is securely joined.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {string}
   */
  getRebuildAttemptStatus(station, slug) {
    const poolStatus = this.#counterweights.status(slug);
    const attempt = this.#rebuildAttempts.get(station);

    return poolStatus ?? (attempt?.owner === slug ? attempt.status : "failed");
  }

  /**
   * A shared volume clock keeps the source and growing tissue complementary.
   * Full transfer follows the native handoff, never merely an elapsed timer.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{progress:number,nativeAdmitted:boolean}}
   */
  getRebuildMorphProgress(station, slug) {
    const poolMorph = this.#counterweights.morph(slug);
    if (poolMorph) {
      return {
        ...poolMorph,
        liquidSourceOwned: true,
      };
    }
    const attempt = this.#rebuildAttempts.get(station);
    const owned = attempt?.owner === slug && attempt.status !== "failed";
    const growth = owned ? this.#growingStations.get(station) : null;
    const nativeAdmitted = Boolean(owned && !growth && this.isIntact(station));

    return {
      progress: nativeAdmitted ? 1 : Math.min(0.999, slimeBridgeTransferProgress(growth?.age ?? 0)),
      nativeAdmitted,
      liquidSourceOwned: owned,
    };
  }

  /**
   * The original contributor reforms at its failed material, never at a gate.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{position:import("playcanvas").Vec3,velocity:import("playcanvas").Vec3,bankTarget:import("playcanvas").Vec3}|null}
   */
  getRebuildRecovery(station, slug) {
    if (this.#counterweights.status(slug)) {
      const bank = this.stationPosition(station);
      const pose = this.#slimePhysics.getPose(station);
      const direction = station < this.definition.span.start ? -1 : 1;
      const position = (direction < 0 ? pose?.start : pose?.end)?.clone() ?? bank.clone();
      position[this.definition.span.horizontal ? "x" : "z"] += direction * 0.25;

      return {
        position,
        velocity: this.#slimePhysics.getEntity(station)?.rigidbody?.linearVelocity?.clone() ?? new this.#pc.Vec3(),
        bankTarget: this.#counterweightReturnTargets.get(slug)?.clone() ?? bank,
      };
    }
    const recovery = this.#rebuildRecoveries.get(station);

    return recovery?.owner === slug ? {
      position: recovery.position.clone(),
      velocity: recovery.velocity.clone(),
      bankTarget: recovery.bankTarget.clone(),
    } : null;
  }

  /**
   * Reject a precarious placement and retain evidence for a more cautious retry.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @param {boolean} preserveReservation Keep an attached donor's exclusive slot during backoff.
   * @returns {boolean}
   */
  failRebuildAttempt(station, slug, preserveReservation = false) {
    if (this.#counterweights.status(slug)) {
      this.#counterweights.release(slug);
      this.#syncSlimePhysics();

      return true;
    }
    const nativeAdmitted = this.isIntact(station) && this.#rebuildAttempts.get(station)?.owner === slug;

    return !this.#destroying && this.#rollbackRebuildAttempt(station, slug, preserveReservation, nativeAdmitted);
  }

  /**
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @param {boolean} preserveReservation
   * @param {boolean} structural A previously committed body lost its support.
   * @returns {boolean}
   */
  #rollbackRebuildAttempt(station, slug, preserveReservation, structural) {
    const attempt = this.#rebuildAttempts.get(station);
    const reserved = this.#rebuildReservations.get(station) === slug;
    if (attempt?.owner === slug && attempt.status === "failed" && this.#heldRetryReservations.has(station)) {
      if (!preserveReservation) {
        this.#rebuildReservations.delete(station);
        this.#reservationDirections.delete(station);
        this.#heldRetryReservations.delete(station);
      }
      return false;
    }
    if (!structural && !reserved && attempt?.owner === slug && attempt.status !== "growing") {
      return false;
    }
    if (attempt?.owner !== slug && !reserved) {
      return false;
    }
    this.#saveRebuildRecovery(station, slug);
    if (structural) {
      const direction = this.#reservationDirections.get(station);
      this.#supportFailures.set(direction, (this.#supportFailures.get(direction) ?? 0) + 1);
    }
    const map = this.#runtime.mapData;
    this.#placementFailures.set(station, (this.#placementFailures.get(station) ?? 0) + 1);
    this.#rebuildAttempts.set(station, {
      owner: slug,
      status: "failed",
      age: 0,
    });
    if (preserveReservation) {
      this.#rebuildReservations.set(station, slug);
      this.#heldRetryReservations.add(station);
    } else {
      this.#rebuildReservations.delete(station);
      this.#reservationDirections.delete(station);
      this.#heldRetryReservations.delete(station);
    }
    this.#growingStations.delete(station);
    const cells = this.#stationCells(station);
    for (const cell of cells) {
      const metadata = map.tileMeta[cell.row][cell.col];
      metadata.bridgeCollapsed = true;
      metadata.bridgeSlime = false;
      metadata.bridgeSlimeSupported = false;
    }
    this.#setRiverBridge(cells, false);
    this.#rebuildBridge();
    WalkingPaths.rebuild(map);
    this.#app.fire("bridge:collapsed", {
      map,
      cells,
    });

    return true;
  }

  /**
   * Revoke the failed material and its dependent construction branch together.
   * Capture all local recovery positions before sync removes any native bodies.
   */
  #checkCommittedStructure() {
    const failed = this.#slimePhysics.getFailedStations?.() ?? [];
    const rejected = new Map();
    for (const failedStation of failed) {
      const direction = this.#reservationDirections.get(failedStation);
      if (!direction) {
        continue;
      }
      for (const [station, attempt] of this.#rebuildAttempts) {
        if (attempt.status === "failed" || this.#reservationDirections.get(station) !== direction ||
          (station - failedStation) * -direction < 0) {
          continue;
        }
        rejected.set(station, attempt.owner);
      }
      for (const [station, owner] of this.#rebuildReservations) {
        if (this.#reservationDirections.get(station) === direction && (station - failedStation) * -direction >= 0) {
          rejected.set(station, owner);
        }
      }
    }
    for (const [station, owner] of rejected) {
      this.#saveRebuildRecovery(station, owner);
    }
    for (const [station, owner] of rejected) {
      if (this.#rebuildReservations.get(station) === owner) {
        const direction = this.#reservationDirections.get(station);
        const { span } = this.definition;
        const bank = this.stationPosition(direction < 0 ? span.start - 1 : span.end + 1);
        owner.cancelBridgeApproach?.(this.#bridge, station, bank);
      }
    }
    for (const [station, owner] of rejected) {
      this.#rollbackRebuildAttempt(station, owner, true, true);
    }
  }

  /**
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {{position:import("playcanvas").Vec3,velocity:import("playcanvas").Vec3}|null} recovery
   */
  #saveRebuildRecovery(station, owner, recovery = captureSlimeRecovery(this.#pc, this.#slimePhysics, station)) {
    if (recovery) {
      const direction = this.#reservationDirections.get(station);
      const { span } = this.definition;
      this.#rebuildRecoveries.set(station, {
        owner,
        ...recovery,
        bankTarget: this.stationPosition(direction < 0 ? span.start - 1 : span.end + 1),
      });
    }
  }

  /**
   * @param {number} station
   */
  #completeSlimeStation(station) {
    const direction = this.#reservationDirections.get(station);
    const owner = this.#rebuildAttempts.get(station).owner;
    const bound = owner.isBridgeBoundTo?.(this.#bridge, station) === true;
    if (!direction || !this.#constructionChainReady(station, direction, bound) || !this.#rebuildPlacement(station, direction)) {
      return;
    }
    this.#saveRebuildRecovery(station, owner, {
      position: owner.position.clone(),
      velocity: owner.entity?.rigidbody?.linearVelocity?.clone() ?? new this.#pc.Vec3(),
    });
    if (owner.beginBridgeMaterialValidation?.(this.#bridge, station) === false) {
      this.failRebuildAttempt(station, owner, true);

      return;
    }
    const map = this.#runtime.mapData;
    const cells = this.#stationCells(station);
    for (const cell of cells) {
      const metadata = map.tileMeta[cell.row][cell.col];
      metadata.bridgeCollapsed = false;
      metadata.bridgeCollapsing = false;
      metadata.bridgeSlime = true;
      metadata.bridgeSlimeSupported = false;
    }
    this.#growingStations.delete(station);
    this.#rebuildBridge();
    this.#rebuildAttempts.get(station).admissionFrame = true;
  }

  /**
   * Publish topology only after native placement validation admits the donor.
   * @param {number} station
   */
  #publishSlimeStation(station) {
    const map = this.#runtime.mapData;
    const cells = this.#stationCells(station);
    this.#setRiverBridge(cells, true);
    WalkingPaths.rebuild(map);
    this.#app.fire("bridge:restored", {
      map,
      cells,
    });
  }

  /**
   * @param {import("../ObjectTypes.js").GridPoint[]} cells
   * @param {boolean} restored
   */
  #setRiverBridge(cells, restored) {
    for (const cell of cells) {
      for (const river of this.#runtime.mapData.riverData ?? []) {
        for (const riverCell of river.cells ?? []) {
          if (riverCell.col === cell.col && riverCell.row === cell.row) {
            riverCell.underBridge = restored;
          }
        }
      }
    }
  }

  #syncSlimePhysics() {
    const { span } = this.definition;
    const stations = new Map();
    const anticipatedLoads = new Map();
    let connected = true;
    for (let station = span.start; station <= span.end; station++) {
      connected &&= this.isIntact(station);
      if (this.isIntact(station) && this.#stationCells(station).some(this.#isSlimeCell.bind(this))) {
        stations.set(station, this.stationPosition(station));
        if (station < span.end && !this.isIntact(station + 1)) {
          anticipatedLoads.set(station, 1);
        } else if (station > span.start && !this.isIntact(station - 1)) {
          anticipatedLoads.set(station, -1);
        }
      }
    }
    if (!connected) {
      for (const cell of span.cells) {
        const metadata = this.#runtime.mapData.tileMeta[cell.row][cell.col];
        if (metadata.bridgeSlime) {
          metadata.bridgeSlimeSupported = false;
        }
      }
    }
    const poolMasses = this.#counterweights.masses;
    for (const station of poolMasses.keys()) {
      stations.set(station, this.stationPosition(station));
    }
    const originBank = this.#originDirection < 0 ? span.start - 1 : span.end + 1;
    if (!connected && this.#originDirection !== null && poolMasses.has(originBank) && stations.size === poolMasses.size) {
      anticipatedLoads.set(originBank, -this.#originDirection);
    }
    const supportPending = this.#originDirection !== null &&
      this.#requiredCounterweights(this.#originDirection) > (poolMasses.get(originBank) ?? 0);
    this.#slimePhysics.sync(stations, this.#isSlimeAnchor.bind(this), connected, this.#placementFailures, anticipatedLoads, poolMasses, supportPending);
  }

  /**
   * @param {import("../ObjectTypes.js").GridPoint} cell
   * @returns {boolean}
   */
  #isSlimeCell(cell) {
    return this.#runtime.mapData.tileMeta[cell.row][cell.col].bridgeSlime === true;
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  #isSlimeAnchor(station) {
    const { span } = this.definition;
    if (station >= span.start && station <= span.end) {
      return this.isIntact(station);
    }
    const map = this.#runtime.mapData;
    const groups = new IslandCellOwnership(map).groups;
    const offsets = [Math.floor(span.crossCenter), Math.ceil(span.crossCenter)].map(/**
     * @param {number} across
     */
      (across) => {
        const col = span.horizontal ? station : across;
        const row = span.horizontal ? across : station;
        const group = groups.findIndex(/**
         * @param {Set<string>} cells
         */
          (cells) => cells.has(`${col},${row}`));

        return this.#islandOffsets[group] ?? 0;
      });

    return hasBridgeBankSupport(map, span, this.stationPosition(station).y, station, offsets);
  }

  #admitSlimeSupport() {
    const map = this.#runtime.mapData;
    const cells = [];
    for (const cell of this.definition.span.cells) {
      const metadata = map.tileMeta[cell.row][cell.col];
      const station = this.definition.span.horizontal ? cell.col : cell.row;
      if (metadata.bridgeSlime && !metadata.bridgeSlimeSupported && this.#rebuildAttempts.get(station)?.status !== "growing") {
        metadata.bridgeSlimeSupported = true;
        cells.push(cell);
      }
    }
    if (cells.length > 0) {
      WalkingPaths.rebuild(map);
      this.#app.fire("bridge:restored", {
        map,
        cells,
      });
    }
  }

  #withdrawSlimeSupport() {
    const map = this.#runtime.mapData;
    const cells = [];
    for (const cell of this.definition.span.cells) {
      const metadata = map.tileMeta[cell.row][cell.col];
      if (metadata.bridgeSlimeSupported) {
        metadata.bridgeSlimeSupported = false;
        cells.push(cell);
      }
    }
    if (cells.length > 0) {
      WalkingPaths.rebuild(map);
      this.#app.fire("bridge:collapsed", {
        map,
        cells,
      });
    }
  }

  /**
   * @param {number} station
   * @returns {import("../ObjectTypes.js").GridPoint[]}
   */
  #stationCells(station) {
    const { span } = this.definition;

    return span.cells.filter(/**
     *
     * @param {import("../ObjectTypes.js").GridPoint} cell
     */
      (cell) => (span.horizontal ? cell.col : cell.row) === station);
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return BridgeSlimeArtwork.modelUrls;
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   * @param {import("./Bridge.js").Bridge} bridge
   * @param {() => void} rebuildBridge
   * @param {() => boolean} collapsing
   */
  constructor({ pc, app, modelLibrary, runtime }, bridge, rebuildBridge, collapsing) {
    this.#pc = pc;
    this.#app = app;
    this.#models = modelLibrary;
    this.#runtime = runtime;
    this.#bridge = bridge;
    this.#rebuildBridge = rebuildBridge;
    this.#collapsing = collapsing;
    this.#floating = BridgeProfile.isFloating(this.definition, runtime.mapData);
    this.entity = new pc.Entity("Living bridge replacement");
    bridge.entity.addChild(this.entity);
    this.#slimePhysics = new BridgeSlimePhysics({
      pc,
      app,
      root: this.entity,
      horizontal: this.definition.span.horizontal,
    });
    runtime.collisionWorld?.add(this.#slimePhysics, { physicsSurface: false });
  }

  /**
   * @returns {import("../ObjectTypes.js").MapObjectDefinition}
   */
  get definition() {
    return this.#bridge.definition;
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  isIntact(station) {
    return this.#bridge.isIntact(station);
  }

  /**
   * @param {number} station
   * @returns {import("playcanvas").Vec3}
   */
  stationPosition(station) {
    return this.#bridge.stationPosition(station);
  }

  /**
   * @param {number} along
   * @returns {number}
   */
  #rise(along) {
    return this.#floating ? 0 : BridgeProfile.rise(this.definition.span, along);
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  hasStation(station) {
    return this.#growingStations.has(station) || this.#stationCells(station).some(this.#isSlimeCell.bind(this));
  }

  /**
   * @param {number} offset
   * @param {number[]} offsets
   */
  setIslandOffsets(offset, offsets) {
    this.#islandOffset = offset;
    this.#islandOffsets = offsets;
    this.entity.setLocalPosition(0, offset, 0);
    this.#syncSlimePhysics();
  }

  rebuild() {
    this.#slimeDeck?.destroy();
    this.#slimeDeck = new BridgeSlimeArtwork({
      pc: this.#pc,
      modelLibrary: this.#models,
      root: this.entity,
    });
    const { span } = this.definition;
    for (let station = span.start; station <= span.end; station++) {
      if (!this.isIntact(station) && !this.#growingStations.has(station)) {
        continue;
      }
      const position = this.stationPosition(station);
      position.y -= this.#islandOffset;
      const growth = this.#growingStations.get(station);
      const slime = this.#stationCells(station).some(/**
       *
       * @param {import("../ObjectTypes.js").GridPoint} cell
       */
        (cell) => this.#runtime.mapData.tileMeta[cell.row][cell.col].bridgeSlime);
      if (growth || slime) {
        this.#slimeDeck.addStation({
          growing: Boolean(growth),
          bankFeed: growth?.bankFeed ?? false,
          liquidSourceOwned: growth?.bankFeed ?? false,
          sourceOwner: growth ? this.#rebuildAttempts.get(station)?.owner : null,
          growthAge: growth?.age ?? 0,
          sourcePosition: growth ? this.#rebuildAttempts.get(station)?.owner.position.clone() ?? growth.source : null,
          definition: this.definition,
          station,
          position,
          startRise: this.#rise(station - 0.5) - this.#rise(station),
          endRise: this.#rise(station + 0.5) - this.#rise(station),
        });
      }
    }
    this.#syncSlimePhysics();
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    let failures = 0;
    for (const count of this.#placementFailures.values()) {
      failures += count;
    }

    return `${this.#slimePhysics.status}${failures ? `${failures} failed placements | ` : ""}`;
  }

  /**
   * @param {number} deltaTime
   */
  onFrame(deltaTime) {
    if (this.#counterweights.update(deltaTime, this.#bridge, this.#requiredCounterweights.bind(this), this.#prepareCounterweightReturn.bind(this))) {
      this.#syncSlimePhysics();
    }
    this.#slimeDeck?.setPoolTransfers?.(this.#counterweights.transfers, this.stationPosition.bind(this));
    const poses = this.#slimePhysics.update(deltaTime);
    if (this.#slimePhysics.connected && !this.rebuildDemand) {
      this.#originDirection = null;
      this.#supportFailures.clear();
    }
    this.#checkCommittedStructure();
    for (const station of poses.keys()) {
      const current = this.#slimePhysics.getPose(station);
      if (current) {
        poses.set(station, current);
      } else {
        poses.delete(station);
      }
    }
    this.#slimeDeck?.setSpanPoses?.(poses);
    if (this.#slimePhysics.settled) {
      this.#admitSlimeSupport();
    } else if (!this.#slimePhysics.connected) {
      this.#withdrawSlimeSupport();
    }
    this.#slimeDeck?.setLoads(this.#gelReaction.update(deltaTime, this.#runtime.objects, {
      span: this.definition.span,
      stationPosition: this.stationPosition.bind(this),
    }));
    const donorSources = new Map();
    for (const station of this.#growingStations.keys()) {
      const attempt = this.#rebuildAttempts.get(station);
      if (attempt?.status === "growing") {
        donorSources.set(station, attempt.owner.position.clone());
      }
    }
    this.#slimeDeck?.setDonorSources?.(donorSources);
    this.#slimeDeck?.update(deltaTime);
    for (const [station, growth] of this.#growingStations) {
      growth.age += Math.max(0, deltaTime);
      if (growth.age >= SLIME_BRIDGE_GROWTH_SECONDS) {
        this.#completeSlimeStation(station);
        if (this.#growingStations.has(station) && growth.age >= SLIME_BRIDGE_GROWTH_SECONDS + 12) {
          this.failRebuildAttempt(station, this.#rebuildAttempts.get(station).owner, true);
        }
      }
    }
    for (const [station, attempt] of this.#rebuildAttempts) {
      if (attempt.status !== "growing" || this.#growingStations.has(station)) {
        continue;
      }
      if (attempt.admissionFrame) {
        attempt.admissionFrame = false;
        continue;
      }
      attempt.age += Math.max(0, deltaTime);
      const status = this.#slimePhysics.getPlacementStatus(station);
      if (status === "stable") {
        attempt.stableAge = (attempt.stableAge ?? 0) + Math.max(0, deltaTime);
        if (attempt.stableAge >= 0.2) {
          attempt.status = "complete";
          this.#publishSlimeStation(station);
        }
      } else if (status === "failed" || attempt.age >= 12 && !this.#slimePhysics.isAwaitingSupport?.(station)) {
        this.failRebuildAttempt(station, attempt.owner, true);
      } else {
        attempt.stableAge = 0;
      }
    }
  }

  destroy() {
    this.#destroying = true;
    for (const [owner, donor] of [...this.#counterweights.entries]) {
      const recovery = this.getRebuildRecovery(donor.station, owner);
      this.#counterweights.release(owner);
      owner.releaseBridgeContribution?.(recovery?.position ?? donor.approach, recovery?.velocity, this.#bridge, donor.station);
    }
    this.#stagedContributors.clear();
    for (const [station, attempt] of this.#rebuildAttempts) {
      if (!attempt.owner.ownsBridgeContribution?.(this.#bridge, station)) {
        continue;
      }
      const recovery = captureSlimeRecovery(this.#pc, this.#slimePhysics, station) ??
        this.getRebuildRecovery(station, attempt.owner);
      attempt.owner.releaseBridgeContribution?.(recovery?.position ?? attempt.owner.position, recovery?.velocity, this.#bridge, station);
    }
    this.#rebuildRecoveries.clear();
    this.#rebuildAttempts.clear();
    this.#placementFailures.clear();
    this.#supportFailures.clear();
    this.#counterweightReturnTargets.clear();
    this.#heldRetryReservations.clear();
    this.#runtime.collisionWorld?.remove?.(this.#slimePhysics);
    this.#slimePhysics.destroy();
    this.#rebuildReservations.clear();
    this.#reservationDirections.clear();
    this.#growingStations.clear();
    this.#slimeDeck?.destroy();
    this.#slimeDeck = null;
    this.entity.destroy();
  }
}
