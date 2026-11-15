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
      banks: [this.#rebuildBank(-1, nearCount), this.#rebuildBank(1, farCount)].filter(Boolean),
    } : null;
  }

  /**
   * Optional dispatch hints never restrict a worker's physical construction side.
   * @param {number} direction
   * @param {number} count
   * @returns {BridgeRebuildBank|null}
   */
  #rebuildBank(direction, count) {
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

      return {
        station,
        direction,
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
    });
    this.#rebuildBridge();

    return true;
  }

  /**
   * Keep the original donor until its admitted physical mass is securely joined.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {string}
   */
  getRebuildAttemptStatus(station, slug) {
    const attempt = this.#rebuildAttempts.get(station);

    return attempt?.owner === slug ? attempt.status : "failed";
  }

  /**
   * A shared volume clock keeps the source and growing tissue complementary.
   * Full transfer follows the native handoff, never merely an elapsed timer.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{progress:number,nativeAdmitted:boolean}}
   */
  getRebuildMorphProgress(station, slug) {
    const attempt = this.#rebuildAttempts.get(station);
    const owned = attempt?.owner === slug && attempt.status !== "failed";
    const growth = owned ? this.#growingStations.get(station) : null;
    const nativeAdmitted = Boolean(owned && !growth && this.isIntact(station));

    return {
      progress: nativeAdmitted ? 1 : Math.min(0.999, slimeBridgeTransferProgress(growth?.age ?? 0)),
      nativeAdmitted,
    };
  }

  /**
   * The original contributor reforms at its failed material, never at a gate.
   * @param {number} station
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {{position:import("playcanvas").Vec3,velocity:import("playcanvas").Vec3,bankTarget:import("playcanvas").Vec3}|null}
   */
  getRebuildRecovery(station, slug) {
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
    return !this.#destroying && this.#rollbackRebuildAttempt(station, slug, preserveReservation, false);
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
    this.#slimePhysics.sync(stations, this.#isSlimeAnchor.bind(this), connected, this.#placementFailures, anticipatedLoads);
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
    const poses = this.#slimePhysics.update(deltaTime);
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
      } else if (status === "failed" || attempt.age >= 12) {
        this.failRebuildAttempt(station, attempt.owner, true);
      } else {
        attempt.stableAge = 0;
      }
    }
  }

  destroy() {
    this.#destroying = true;
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
