import { BridgeRailingKit } from "./BridgeRailingKit.js";
import { BridgeInteraction } from "./BridgeInteraction.js";
import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";
import { WalkingPaths } from "../../navigation/WalkingPaths.js";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { BridgeDeckFragment } from "./BridgeDeckFragment.js";
import { BridgeImpactDebris } from "./BridgeImpactDebris.js";

/**
 * A destructible span. Deck and railing batches are rebuilt only at impact;
 * released timbers use Ammo bodies and leave no invisible walkable surface.
 */
export class Bridge {
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
   * @type {TerrainInstanceRenderer|null}
   */
  #deck = null;
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
    return BridgeRailingKit.modelUrls;
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
    this.entity = new pc.Entity(definition.id);
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
      elevation + this.#islandOffset,
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
    if (Math.abs(position.y - elevation - this.#islandOffset) > 0.3) {
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
   * @param {number} station
   * @returns {boolean}
   */
  collapseStation(station) {
    if (this.#collapsePending.size > 0 || !this.isIntact(station)) {
      return false;
    }
    const { span } = this.definition;
    for (const cell of span.cells) {
      const metadata = this.#runtime.mapData.tileMeta[cell.row][cell.col];
      metadata.bridgeCollapsing = !metadata.bridgeCollapsed;
    }
    for (let candidate = span.start; candidate <= span.end; candidate++) {
      if (candidate !== station && this.isIntact(candidate)) {
        this.#collapsePending.add(candidate);
      }
    }
    const fragment = this.#releaseStation(station);
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
    for (const river of map.riverData ?? []) {
      for (const riverCell of river.cells ?? []) {
        const removed = cells.some(/**
         *
         * @param {import("../ObjectTypes.js").GridPoint} cell
         */
          (cell) => cell.col === riverCell.col && cell.row === riverCell.row);
        if (removed) {
          riverCell.underBridge = false;
        }
      }
    }
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

    return `${intact}/${span.length} stations intact | E: hammer next station`;
  }

  /**
   * @param {number} deltaTime
   */
  onFrame(deltaTime) {
    for (const rubble of this.#impactDebris) {
      rubble.update(deltaTime);
    }
    this.#impactDebris = this.#impactDebris.filter(Bridge.#retainImpactDebris);
    const impacts = new Map();
    for (const debris of this.#debris) {
      debris.age += deltaTime;
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
  }

  #rebuild() {
    this.#clearVisual();
    const pc = this.#pc;
    const { span, elevation, material } = this.definition;
    const map = this.#runtime.mapData;
    this.#visual = new pc.Entity("Intact bridge deck and railings");
    this.#visual.setLocalPosition(0, this.#islandOffset, 0);
    this.entity.addChild(this.#visual);
    this.#deck = new TerrainInstanceRenderer({
      pc,
      app: this.#app,
      root: this.#visual,
      materials: this.#runtime.materials,
    });
    const railings = new BridgeRailingKit({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
    let start = span.start;
    while (start <= span.end) {
      if (!this.isIntact(start)) {
        start++;
        continue;
      }
      let end = start;
      while (this.isIntact(end + 1)) {
        end++;
      }
      const run = {
        ...span,
        start,
        end,
        center: (start + end) / 2,
        length: end - start + 1,
      };
      for (let station = start; station <= end; station++) {
        const position = this.stationPosition(station);
        this.#deck.addBoxMatrix("path", material, position.x, elevation - 0.12, position.z,
          0, span.horizontal ? 1 : 2, 0.24, span.horizontal ? 2 : 1, "surfaceOnly", "none");
        this.#addStationRails(railings, station);
      }
      const x = (span.horizontal ? run.center : span.crossCenter) - (map.cols - 1) / 2;
      const z = (span.horizontal ? span.crossCenter : run.center) - (map.rows - 1) / 2;
      this.#deck.addBoxMatrix("path", material, x, elevation - 0.12, z,
        0, span.horizontal ? run.length : 2, 0.24, span.horizontal ? 2 : run.length,
        span.horizontal ? "bridgeHorizontalSidesOnly" : "bridgeVerticalSidesOnly", material);
      start = end + 1;
    }
    this.#deck.build();
    this.#buffers = railings.build();
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
    const start = station === span.start ? -0.34 : -0.5;
    const end = station === span.end ? 0.34 : 0.5;
    const direction = new this.#pc.Vec3(span.horizontal ? 1 : 0, 0, span.horizontal ? 0 : 1);
    this.#addStationRailSide(railings, position, direction, start, end, material, -1, station === span.end);
    this.#addStationRailSide(railings, position, direction, start, end, material, 1, station === span.end);
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
    const position = center.clone().add(direction.clone().mulScalar(start));
    position.x += direction.z * side * 0.93;
    position.z += direction.x * side * 0.93;
    railings.addRailing({
      position,
      direction,
      length: end - start,
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
    });
    this.entity.addChild(fragment.entity);
    this.#debris.push(fragment);
    this.#collapseStations([station]);

    return fragment;
  }

  #clearVisual() {
    this.#deck?.destroy();
    this.#deck = null;
    this.#visual?.destroy();
    this.#visual = null;
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.#buffers = [];
  }

  destroy() {
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
