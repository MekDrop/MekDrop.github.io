import { BridgeRailingKit } from "./BridgeRailingKit.js";
import { BridgeInteraction } from "./BridgeInteraction.js";
import { BridgeArtwork } from "./BridgeArtwork.js";
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
import { BridgeDeckFragment } from "./BridgeDeckFragment.js";
import { BridgeImpactDebris } from "./BridgeImpactDebris.js";
import { DoorAudio } from "../../audio/door/DoorAudio.js";
import { GameObjectAudio } from "../../audio/GameObjectAudio.js";

/**
 * @typedef {{direction:number,position:import("playcanvas").Vec2,elevation:number,count:number}} BridgeRebuildBank
 * @typedef {{creature:string,count:number,position:import("playcanvas").Vec2,banks?:BridgeRebuildBank[]}} BridgeRebuildDemand
 */

/**
 * A destructible span. Deck and railing batches are rebuilt only at impact;
 * released timbers use Ammo bodies and leave no invisible walkable surface.
 */
export class Bridge {
  /**
   * @type {GameObjectAudio|undefined}
   */
  #audio;
  /**
   * @type {import("playcanvas").Entity|undefined}
   */
  #audioEntity;
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
   * @type {import("playcanvas").Entity|null}
   */
  #visual = null;
  /**
   * @type {BridgeArtwork|null}
   */
  #deck = null;
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
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #buffers = [];
  /**
   * @type {BridgeDeckFragment[]}
   */
  #debris = [];
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
  #floating = false;
  /**
   * @type {number}
   */
  #anchorDirection = 1;
  /**
   * Stations whose support has failed but whose deck has not yet tipped free.
   * @type {Set<number>}
   */
  #collapsePending = new Set();
  /**
   * @type {Array<{fragment: BridgeDeckFragment, station: number, direction: number, connectPrevious: boolean}>}
   */
  #collapseFronts = [];
  /**
   * @type {Array<{fragment: BridgeDeckFragment, next: BridgeDeckFragment}>}
   */
  #deckLinks = [];
  /**
   * @type {BridgeImpactDebris[]}
   */
  #impactDebris = [];
  /**
   * @type {ReturnType<typeof BridgeImpactDebris.prepareResources>|null}
   */
  #impactResources = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #impactWarmHandle = null;
  /**
   * @type {number}
   */
  #impactWarmRetries = 0;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [...BridgeRailingKit.modelUrls, ...BridgeArtwork.modelUrls, ...BridgeSlimeArtwork.modelUrls];
  }

  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [DoorAudio.collapse.wavUrl];
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, app, modelLibrary, definition, runtime }) {
    this.#pc = pc;
    this.#app = app;
    this.#models = modelLibrary;
    this.#runtime = runtime;
    this.definition = definition;
    this.#floating = BridgeProfile.isFloating(definition, runtime.mapData);
    if (this.#floating) {
      this.#anchorDirection = BridgeProfile.anchorDirection(definition, runtime.mapData);
    }
    this.entity = new pc.Entity(definition.id);
    this.#slimePhysics = new BridgeSlimePhysics({
      pc,
      app,
      root: this.entity,
      horizontal: definition.span.horizontal,
    });
    runtime.collisionWorld?.add(this.#slimePhysics, { physicsSurface: false });
    if (runtime.audioLibrary) {
      this.#audioEntity = new pc.Entity("Bridge destruction audio");
      this.entity.addChild(this.#audioEntity);
      this.#audio = new GameObjectAudio(this.#audioEntity, app, runtime.audioLibrary, {
        collapse: DoorAudio.collapse,
      }, 0.45);
      this.#audio.follow(() => runtime.objects.getOne("hero")?.position ?? null);
    }
    this.#rebuild();
    // Resume an in-flight collapse after the normal object hot-reload lifecycle.
    for (const cell of definition.span.cells) {
      if (runtime.mapData.tileMeta[cell.row][cell.col].bridgeCollapsing) {
        this.#collapsePending.add(definition.span.horizontal ? cell.col : cell.row);
      }
    }
    if (this.#collapsePending.size > 0) {
      // The old physics bodies are disposed during hot reload. Resume the failed
      // structure as free deck sections rather than leaving unsupported artwork.
      const pending = [...this.#collapsePending];
      this.#collapsePending.clear();
      for (const station of pending) {
        this.#releaseStation(station);
      }
    }
  }

  /**
   * Prepare shared chip geometry during loading, then compile after the first
   * real render initializes the engine's clustered-light shader chunks.
   */
  onSceneReady() {
    this.#impactResources ??= BridgeImpactDebris.prepareResources({
      pc: this.#pc,
      app: this.#app,
      materials: this.#runtime.materials,
      modelLibrary: this.#models,
      material: this.definition.material,
    });
    this.#impactWarmHandle?.off();
    this.#impactWarmRetries = 0;
    this.#scheduleImpactWarmup();
  }

  #scheduleImpactWarmup() {
    this.#impactWarmHandle = this.#app.once("postrender", this.#warmImpactResources, this);
  }

  #warmImpactResources() {
    this.#impactWarmHandle = null;
    const ready = this.#impactResources?.warmShaders(this.#runtime.camera?.camera);
    if (ready === false && this.#impactWarmRetries++ < 3) {
      this.#scheduleImpactWarmup();
    }
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  isIntact(station) {
    const { span } = this.definition;
    if (!Number.isInteger(station) || station < span.start || station > span.end) {
      return false;
    }
    return this.#stationCells(station).every(this.#cellIntact.bind(this));
  }

  /**
   * @param {import("../ObjectTypes.js").GridPoint} cell
   * @returns {boolean}
   */
  #cellIntact(cell) {
    return !this.#runtime.mapData.tileMeta[cell.row][cell.col].bridgeCollapsed;
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
   * @param {number} station
   * @returns {import("playcanvas").Vec3}
   */
  stationPosition(station) {
    const { span, elevation } = this.definition;
    const { cols, rows } = this.#runtime.mapData;

    return new this.#pc.Vec3(
      (span.horizontal ? station : span.crossCenter) - (cols - 1) / 2,
      elevation + this.#rise(station) + this.#islandOffset,
      (span.horizontal ? span.crossCenter : station) - (rows - 1) / 2,
    );
  }

  /**
   * @param {import("../characters/hero/Hero.js").Hero} hero
   * @returns {number|null}
   */
  targetStation(hero) {
    if (this.#collapsePending.size > 0) {
      return null;
    }
    const { span, elevation } = this.definition;
    const { cols, rows, tileMeta, grid } = this.#runtime.mapData;
    const position = hero.position;
    const along = (span.horizontal ? position.x : position.z) + ((span.horizontal ? cols : rows) - 1) / 2;
    if (Math.abs(position.y - elevation - this.#rise(along) - this.#islandOffset) > 0.3) {
      return null;
    }
    const col = position.x + (cols - 1) / 2;
    const row = position.z + (rows - 1) / 2;
    const across = span.horizontal ? row : col;
    if (Math.abs(across - span.crossCenter) > 0.75) {
      return null;
    }
    const facing = hero.facingDirection;
    const alongFacing = span.horizontal ? facing.x : facing.z;
    if (Math.abs(alongFacing) < 0.7) {
      return null;
    }
    const current = Math.round(span.horizontal ? col : row);
    const heroCol = Math.round(col);
    const heroRow = Math.round(row);
    if (tileMeta[heroRow]?.[heroCol]?.bridgeCollapsed || !grid[heroRow]?.[heroCol]) {
      return null;
    }
    const next = current + Math.sign(alongFacing);

    return this.isIntact(next) ? next : null;
  }

  /**
   * @param {{hero: import("../characters/hero/Hero.js").Hero, onComplete?: () => void}} options
   * @returns {BridgeInteraction|null}
   */
  findInteraction({ hero, onComplete }) {
    const station = this.targetStation(hero);

    return station === null ? null : new BridgeInteraction(this, hero, station, onComplete);
  }

  /**
   * Remaining living deck sections, including sections claimed by active slugs.
   * @returns {BridgeRebuildDemand|null}
   */
  get rebuildDemand() {
    const { span } = this.definition;
    if (this.#collapsePending.size > 0 || span.cells.every(this.#hasLowerPath.bind(this))) {
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
        const continuing = slug.isBridgeBoundTo?.(this, station) === true ||
          slug.isBridgeApproachingFromGround?.(this, station) === true;
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
    this.#rebuild();

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
    this.#rebuild();
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
        owner.cancelBridgeApproach?.(this, station, bank);
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
    const bound = owner.isBridgeBoundTo?.(this, station) === true;
    if (!direction || !this.#constructionChainReady(station, direction, bound) || !this.#rebuildPlacement(station, direction)) {
      return;
    }
    this.#saveRebuildRecovery(station, owner, {
      position: owner.position.clone(),
      velocity: owner.entity?.rigidbody?.linearVelocity?.clone() ?? new this.#pc.Vec3(),
    });
    if (owner.beginBridgeMaterialValidation?.(this, station) === false) {
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
    this.#rebuild();
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

  /**
   * @param {number} station
   * @returns {boolean}
   */
  collapseStation(station) {
    if (this.#collapsePending.size > 0 || !this.isIntact(station)) {
      return false;
    }
    const position = this.stationPosition(station);
    this.#audioEntity?.setPosition(position.x, position.y, position.z);
    this.#audio?.play("collapse");
    const { span } = this.definition;
    for (const cell of span.cells) {
      const metadata = this.#runtime.mapData.tileMeta[cell.row][cell.col];
      metadata.bridgeCollapsing = !metadata.bridgeCollapsed;
    }
    this.#app.fire("bridge:collapsing", {
      map: this.#runtime.mapData,
      cells: span.cells,
      elevation: this.definition.elevation,
    });
    for (let candidate = span.start; candidate <= span.end; candidate++) {
      if (candidate !== station && this.isIntact(candidate)) {
        this.#collapsePending.add(candidate);
      }
    }
    const fragment = this.#releaseStation(station);
    if (this.#floating) {
      // Lift failure travels along the platform. No bank hinge can pull down
      // a self-supported deck, and a dropping edge is not the release signal.
      this.#addFloatingFront(fragment, station, -1);
      this.#addFloatingFront(fragment, station, 1);

      return true;
    }
    const before = this.#collapsePending.has(station - 1);
    const after = this.#collapsePending.has(station + 1);
    if (before && after) {
      // A middle strike opens a hole first. Both severed sides then tip into it.
      this.#collapseFronts.push({
        fragment,
        station,
        direction: -1,
        connectPrevious: false,
      });
      this.#collapseFronts.push({
        fragment,
        station,
        direction: 1,
        connectPrevious: false,
      });
    } else if (before || after) {
      const direction = before ? -1 : 1;
      fragment.anchor(direction);
      this.#collapseFronts.push({
        fragment,
        station,
        direction,
        connectPrevious: true,
      });
    }

    return true;
  }

  /**
   * @param {BridgeDeckFragment} fragment
   * @param {number} station
   * @param {number} direction
   */
  #addFloatingFront(fragment, station, direction) {
    if (this.#collapsePending.has(station + direction)) {
      this.#collapseFronts.push({
        fragment,
        station,
        direction,
        connectPrevious: false,
      });
    }
  }

  /**
   * @param {number} along
   * @returns {number}
   */
  #rise(along) {
    return this.#floating ? 0 : BridgeProfile.rise(this.definition.span, along);
  }

  /**
   * Release a wave of unsupported deck through Ammo, then update shared topology.
   * @param {number[]} stations
   */
  #collapseStations(stations) {
    const map = this.#runtime.mapData;
    const cells = stations.flatMap(this.#stationCells.bind(this));
    for (const cell of cells) {
      map.tileMeta[cell.row][cell.col].bridgeCollapsed = true;
      map.tileMeta[cell.row][cell.col].bridgeCollapsing = false;
    }
    this.#setRiverBridge(cells, false);
    this.#rebuild();
    WalkingPaths.rebuild(map);
    this.#app.fire("bridge:collapsed", {
      map,
      cells,
    });
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    const { span } = this.definition;
    let intact = 0;
    for (let station = span.start; station <= span.end; station++) {
      intact += Number(this.isIntact(station));
    }

    let failures = 0;
    for (const count of this.#placementFailures.values()) {
      failures += count;
    }

    return `${intact}/${span.length} stations intact | ${this.#slimePhysics.status}${failures ? `${failures} failed placements | ` : ""}E: hammer next station`;
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
    for (const rubble of this.#impactDebris) {
      rubble.update(deltaTime);
    }
    this.#impactDebris = this.#impactDebris.filter(Bridge.#retainImpactDebris);
    const impacts = new Map();
    for (const debris of this.#debris) {
      debris.age += deltaTime;
      debris.update(deltaTime);
      const impact = debris.consumeGroundImpact();
      if (impact) {
        impacts.set(debris, impact);
      }
      if (debris.age > 5.5) {
        debris.opacity = Math.max(0, (7 - debris.age) / 1.5);
      }
    }
    const fronts = this.#collapseFronts;
    this.#collapseFronts = [];
    for (const front of fronts) {
      const nextStation = front.station + front.direction;
      const hasNext = this.#collapsePending.has(nextStation);
      if (this.#floating) {
        if (hasNext && front.fragment.age >= 0.16) {
          const next = this.#releaseStation(nextStation);
          this.#collapsePending.delete(nextStation);
          this.#addFloatingFront(next, nextStation, front.direction);
        } else if (hasNext) {
          this.#collapseFronts.push(front);
        }
        continue;
      }
      const drop = front.fragment.freeEdgeDrop(front.direction);
      // Read the live Ammo pose: the hanging end must pull down before its
      // neighbour loses support. The timeout only releases jammed constraints.
      if (hasNext && (drop > 0.22 || impacts.has(front.fragment) || front.fragment.age > 0.85)) {
        const next = this.#releaseStation(nextStation);
        this.#collapsePending.delete(nextStation);
        next.anchor(front.direction);
        if (front.connectPrevious) {
          front.fragment.connectTo(next, front.direction);
          this.#deckLinks.push({
            fragment: front.fragment,
            next,
          });
        }
        this.#collapseFronts.push({
          fragment: next,
          station: nextStation,
          direction: front.direction,
          connectPrevious: true,
        });
      } else if (!hasNext && (drop > 0.32 || impacts.has(front.fragment) || front.fragment.age > 1.2)) {
        front.fragment.releaseSupport();
      } else {
        this.#collapseFronts.push(front);
      }
    }
    this.#updateDeckLinks(impacts);
    this.#replaceGroundImpacts(impacts);
    const expired = this.#debris.filter(Bridge.#debrisExpired);
    // Remove every constraint before deleting any body it could reference.
    if (expired.length > 0) {
      for (const fragment of this.#debris) {
        fragment.releaseSupport();
      }
      for (const fragment of expired) {
        fragment.destroy();
      }
    }
    this.#debris = this.#debris.filter(Bridge.#debrisAlive);
  }

  /**
   * @param {BridgeImpactDebris} rubble
   * @returns {boolean}
   */
  static #retainImpactDebris(rubble) {
    if (rubble.expired) {
      rubble.destroy();

      return false;
    }
    return true;
  }

  /**
   * @param {Map<BridgeDeckFragment, import("./BridgeDeckFragment.js").BridgeGroundImpact>} impacts
   */
  #updateDeckLinks(impacts) {
    const retained = [];
    for (const link of this.#deckLinks) {
      if (impacts.has(link.fragment) || impacts.has(link.next)) {
        link.fragment.releaseSupport();
      } else if (Bridge.#retainDeckLink(link)) {
        retained.push(link);
      }
    }
    this.#deckLinks = retained;
  }

  /**
   * Physics contacts are consumed here, outside Ammo's contact callback. Release
   * every attached joint before replacing a large deck with its small rubble.
   * @param {Map<BridgeDeckFragment, import("./BridgeDeckFragment.js").BridgeGroundImpact>} impacts
   */
  #replaceGroundImpacts(impacts) {
    if (impacts.size === 0) {
      return;
    }
    this.#collapseFronts = this.#collapseFronts.filter(/**
     *
     * @param {{fragment: BridgeDeckFragment, station: number, direction: number, connectPrevious: boolean}} front
     */
      (front) => !impacts.has(front.fragment));
    this.#debris = this.#debris.filter(/**
     *
     * @param {BridgeDeckFragment} fragment
     */
      (fragment) => !impacts.has(fragment));
    for (const [fragment, impact] of impacts) {
      fragment.releaseSupport();
      const station = fragment.station;
      fragment.destroy();
      const rubble = new BridgeImpactDebris({
        pc: this.#pc,
        app: this.#app,
        modelLibrary: this.#models,
        materials: this.#runtime.materials,
        definition: this.definition,
        impact,
        station,
      });
      this.entity.addChild(rubble.entity);
      this.#impactDebris.push(rubble);
    }
  }

  /**
   * @param {{fragment: BridgeDeckFragment, next: BridgeDeckFragment}} link
   * @returns {boolean}
   */
  static #retainDeckLink(link) {
    const cosine = link.fragment.entity.up.dot(link.next.entity.up);
    if (cosine < Math.cos(0.48) || link.fragment.age > 1.6) {
      link.fragment.releaseSupport();

      return false;
    }
    return true;
  }

  /**
   * @param {{age: number}} debris
   * @returns {boolean}
   */
  static #debrisAlive(debris) {
    return debris.age <= 7;
  }

  /**
   * @param {{age: number}} debris
   * @returns {boolean}
   */
  static #debrisExpired(debris) {
    return debris.age > 7;
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} offsets
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandOffsets = offsets;
    const groups = new IslandCellOwnership(this.#runtime.mapData).groups;
    const cell = this.definition.span.cells[0];
    const key = `${cell.col},${cell.row}`;
    const group = groups?.findIndex(/**
     *
     * @param {Set<string>} cells
     */
      (cells) => cells.has(key)) ?? -1;
    this.#islandOffset = offsets[group] ?? 0;
    this.#visual?.setLocalPosition(0, this.#islandOffset, 0);
    this.#syncSlimePhysics();
  }

  #rebuild() {
    this.#clearVisual();
    const pc = this.#pc;
    const { span } = this.definition;
    this.#visual = new pc.Entity("Intact bridge deck and railings");
    this.#visual.setLocalPosition(0, this.#islandOffset, 0);
    this.entity.addChild(this.#visual);
    this.#deck = new BridgeArtwork({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
    this.#slimeDeck = new BridgeSlimeArtwork({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
    const railings = new BridgeRailingKit({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
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
        continue;
      }
      this.#deck.addStation({
        definition: this.definition,
        station,
        position,
        startRise: this.#rise(station - 0.5) - this.#rise(station),
        endRise: this.#rise(station + 0.5) - this.#rise(station),
        floating: this.#floating,
      });
      this.#addStationRails(railings, station);
    }
    if (this.#floating) {
      this.#addIslandSupport();
    }
    this.#buffers = [...this.#deck.build(), ...railings.build()];
    this.#syncSlimePhysics();
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

  #addIslandSupport() {
    const { span } = this.definition;
    const direction = this.#anchorDirection;
    const station = direction > 0 ? span.start : span.end;
    let count = 0;
    while (this.isIntact(station + count * direction)) {
      count++;
    }
    if (count === 0) {
      return;
    }
    const position = this.stationPosition(station);
    position.y -= this.#islandOffset;
    position.x -= span.horizontal ? direction * 0.5 : 0;
    position.z -= span.horizontal ? 0 : direction * 0.5;
    this.#deck.addIslandSupport({
      position,
      horizontal: span.horizontal,
      direction,
      length: Math.min(4.6, count * 0.78),
    });
  }

  /**
   * Keep static and falling station joints aligned, so detaching a deck does
   * not replace its railing with a different bay layout.
   * @param {BridgeRailingKit} railings
   * @param {number} station
   */
  #addStationRails(railings, station) {
    const { span, material } = this.definition;
    const position = this.stationPosition(station);
    position.y -= this.#islandOffset;
    const range = BridgeProfile.railRange(span, station, this.#floating, this.#anchorDirection);
    if (!range) {
      return;
    }
    const { start, end, endPost } = range;
    position.y += this.#rise(station + start) - this.#rise(station);
    const direction = new this.#pc.Vec3(span.horizontal ? 1 : 0,
      (this.#rise(station + end) - this.#rise(station + start)) / (end - start), span.horizontal ? 0 : 1);
    this.#addStationRailSide(railings, position, direction, start, end, material, -1, endPost);
    this.#addStationRailSide(railings, position, direction, start, end, material, 1, endPost);
  }

  /**
   * @param {BridgeRailingKit} railings
   * @param {import("playcanvas").Vec3} center
   * @param {import("playcanvas").Vec3} direction
   * @param {number} start
   * @param {number} end
   * @param {string} material
   * @param {number} side
   * @param {boolean} endPost
   */
  #addStationRailSide(railings, center, direction, start, end, material, side, endPost) {
    const position = center.clone();
    position.x += direction.x * start;
    position.z += direction.z * start;
    position.x += direction.z * side * 0.93;
    position.z += direction.x * side * 0.93;
    railings.addRailing({
      position,
      direction,
      length: (end - start) * direction.length(),
      material,
      endPost,
    });
  }

  /**
   * Replace an intact section with its identical, physically articulated deck.
   * @param {number} station
   * @returns {BridgeDeckFragment}
   */
  #releaseStation(station) {
    const fragment = new BridgeDeckFragment({
      pc: this.#pc,
      app: this.#app,
      modelLibrary: this.#models,
      materials: this.#runtime.materials,
      definition: this.definition,
      station,
      position: this.stationPosition(station),
      floating: this.#floating,
      anchorDirection: this.#anchorDirection,
      startRise: this.#rise(station - 0.5) - this.#rise(station),
      endRise: this.#rise(station + 0.5) - this.#rise(station),
    });
    this.entity.addChild(fragment.entity);
    // Reparenting re-enables the Ammo body, which restores world gravity.
    // Reapply the fragment's temporary lift after it enters its final parent.
    fragment.update(0);
    this.#debris.push(fragment);
    this.#collapseStations([station]);

    return fragment;
  }

  #clearVisual() {
    this.#slimeDeck?.destroy();
    this.#slimeDeck = null;
    this.#deck = null;
    this.#visual?.destroy();
    this.#visual = null;
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.#buffers = [];
  }

  destroy() {
    this.#destroying = true;
    this.#stagedContributors.clear();
    for (const [station, attempt] of this.#rebuildAttempts) {
      if (!attempt.owner.ownsBridgeContribution?.(this, station)) {
        continue;
      }
      const recovery = captureSlimeRecovery(this.#pc, this.#slimePhysics, station) ??
        this.getRebuildRecovery(station, attempt.owner);
      attempt.owner.releaseBridgeContribution?.(recovery?.position ?? attempt.owner.position, recovery?.velocity, this, station);
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
    this.#impactWarmHandle?.off();
    this.#impactWarmHandle = null;
    this.#collapsePending.clear();
    this.#collapseFronts = [];
    this.#deckLinks = [];
    this.#clearVisual();
    for (const debris of this.#debris) {
      debris.releaseSupport();
    }
    for (const debris of this.#debris) {
      debris.destroy();
    }
    this.#debris = [];
    for (const rubble of this.#impactDebris) {
      rubble.destroy();
    }
    this.#impactDebris = [];
    this.#impactResources?.release();
    this.#impactResources = null;
    this.entity.destroy();
  }
}
