import { OverpassStairs } from "./OverpassStairs.js";
import { PathOverpassCollider } from "../../collision/PathOverpassCollider.js";
import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";
import { BridgeRailingKit } from "./BridgeRailingKit.js";
import { BridgeInteraction } from "./BridgeInteraction.js";
import { OverpassDeckFragment } from "./OverpassDeckFragment.js";
import { WalkingPaths } from "../../navigation/WalkingPaths.js";

/**
 * Owns the raised crossing, its retained stair approaches, and Ammo collapse.
 */
export class Overpass {
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
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #railingBuffers = [];
  /**
   * @type {TerrainInstanceRenderer|null}
   */
  #deck = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #visual = null;
  /**
   * @type {OverpassDeckFragment[]}
   */
  #debris = [];
  /**
   * @type {Array<import("playcanvas").VertexBuffer>}
   */
  #buffers;
  /**
   * @type {PathOverpassCollider}
   */
  #collider;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [OverpassStairs.modelUrl, ...BridgeRailingKit.modelUrls];
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
    const { cols, rows } = runtime.mapData;
    this.#buffers = new OverpassStairs({
      pc,
      modelLibrary,
      cols,
      rows,
      overpass: definition.layout,
      materials: runtime.materials,
      root: this.entity,
    }).build();
    this.#collider = new PathOverpassCollider({
      overpass: definition.layout,
      cols,
      rows,
    });
    runtime.collisionWorld.add(this.#collider);
    this.#buildVisual();
  }

  #buildVisual() {
    this.#clearVisual();
    const pc = this.#pc;
    const layout = this.definition.layout;
    this.#visual = new pc.Entity("Raised crossing deck and railings");
    this.entity.addChild(this.#visual);
    const railings = new BridgeRailingKit({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
    const { cols, rows } = this.#runtime.mapData;
    if (!layout.collapsed) {
      this.#deck = new TerrainInstanceRenderer({
        pc,
        app: this.#app,
        root: this.#visual,
        materials: this.#runtime.materials,
      });
      for (const command of this.definition.deckCommands ?? []) {
        this.#deck[command.method](...command.args.map(this.#runtime.resolveMaterial ?? Overpass.#identity));
      }
      this.#deck.build();
      railings.addOverpass(layout, this.definition.railingMaterial ?? "wood", cols, rows);
    } else {
      this.#addApproachRails(railings, -1);
      this.#addApproachRails(railings, 1);
    }
    this.#railingBuffers = railings.build();
  }

  /**
   * Build each surviving approach independently; no railing crosses the gap.
   * @param {BridgeRailingKit} railings
   * @param {number} side
   */
  #addApproachRails(railings, side) {
    const layout = this.definition.layout;
    const first = layout.crossing.row;
    const end = first + (layout.crossing.depth ?? 2);
    /**
     * @param {import("../ObjectTypes.js").GridPoint} cell
     */
    const onSide = (cell) => side < 0 ? cell.row < first : cell.row >= end;
    const slopeCells = layout.slopeCells.filter(onSide);
    const approachCells = layout.approachCells.filter(onSide);
    if (slopeCells.length + approachCells.length === 0) {
      return;
    }
    railings.addOverpass({
      ...layout,
      slopeCells,
      approachCells,
      crossingCells: [],
    }, this.definition.railingMaterial ?? "wood", this.#runtime.mapData.cols, this.#runtime.mapData.rows);
  }

  /**
   * @param {number} station
   * @returns {import("playcanvas").Vec3}
   */
  stationPosition(station) {
    const { crossing, deckElevation } = this.definition.layout;
    const { cols, rows } = this.#runtime.mapData;

    return new this.#pc.Vec3(crossing.col + (crossing.width - 1) / 2 - (cols - 1) / 2,
      deckElevation, station - (rows - 1) / 2);
  }

  /**
   * @param {import("../characters/hero/Hero.js").Hero} hero
   * @returns {number|null}
   */
  targetStation(hero) {
    const layout = this.definition.layout;
    if (layout.collapsed) {
      return null;
    }
    const position = hero.position;
    const { crossing } = layout;
    const { cols, rows } = this.#runtime.mapData;
    const centerX = crossing.col + (crossing.width - 1) / 2 - (cols - 1) / 2;
    const facing = hero.facingDirection;
    if (Math.abs(position.y - layout.deckElevation) > 0.35 ||
      Math.abs(position.x - centerX) > crossing.width / 2 || Math.abs(facing.z) < 0.7) {
      return null;
    }
    const next = Math.round(position.z + (rows - 1) / 2) + Math.sign(facing.z);

    return next >= crossing.row && next < crossing.row + (crossing.depth ?? 2) ? next : null;
  }

  /**
   * @param {{hero:import("../characters/hero/Hero.js").Hero,onComplete?:()=>void}} options
   * @returns {BridgeInteraction|null}
   */
  findInteraction({ hero, onComplete }) {
    const station = this.targetStation(hero);

    return station === null ? null : new BridgeInteraction(this, hero, station, onComplete);
  }

  /**
   * The hammer removes the raised crossing only; lower path and stairs remain.
   * @param {number} station
   * @returns {boolean}
   */
  collapseStation(station) {
    const layout = this.definition.layout;
    const { crossing } = layout;
    if (layout.collapsed || !Number.isInteger(station) || station < crossing.row ||
      station >= crossing.row + (crossing.depth ?? 2)) {
      return false;
    }
    const map = this.#runtime.mapData;
    const cells = layout.crossingCells;
    this.#app.fire("bridge:collapsing", {
      map,
      cells,
      elevation: layout.deckElevation,
    });
    layout.collapsed = true;
    for (const cell of cells) {
      map.tileMeta[cell.row][cell.col].overpassCollapsed = true;
    }
    for (let row = crossing.row; row < crossing.row + (crossing.depth ?? 2); row++) {
      const fragment = new OverpassDeckFragment({
        pc: this.#pc,
        app: this.#app,
        modelLibrary: this.#models,
        definition: this.definition,
        runtime: this.#runtime,
        station: row,
      });
      this.entity.addChild(fragment.entity);
      this.#debris.push(fragment);
    }
    this.#buildVisual();
    WalkingPaths.rebuild(map);
    this.#app.fire("bridge:collapsed", {
      map,
      cells,
    });

    return true;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return this.definition.layout.collapsed ? "Crossing destroyed | stairs retained" : "Raised crossing intact | E: hammer deck";
  }

  /**
   * @param {number} deltaTime
   */
  onFrame(deltaTime) {
    for (const fragment of this.#debris) {
      fragment.update(deltaTime);
    }
    this.#debris = this.#debris.filter(Overpass.#retainFragment);
  }

  /**
   * @param {OverpassDeckFragment} fragment
   */
  static #retainFragment(fragment) {
    if (fragment.expired) {
      fragment.destroy();

      return false;
    }
    return true;
  }

  /**
   * @param {string} value
   */
  static #identity(value) {
    return value;
  }

  #clearVisual() {
    this.#deck?.destroy();
    this.#deck = null;
    this.#visual?.destroy();
    for (const buffer of this.#railingBuffers) {
      buffer.destroy();
    }
    this.#railingBuffers = [];
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {number} radius
   */
  isBelowDeckAt(x, z, elevation, radius) {
    return this.#collider.isBelowDeckAt(x, z, elevation, radius);
  }

  destroy() {
    this.#collider.destroy();
    this.#clearVisual();
    for (const fragment of this.#debris) {
      fragment.destroy();
    }
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.entity.destroy();
  }
}
