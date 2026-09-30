import { EarthSurfaceMaterials } from "./EarthSurfaceMaterials.js";
import { GrassSurfaceMaterials } from "./GrassSurfaceMaterials.js";
import { TerrainMaterialSelector } from "./TerrainMaterialSelector.js";
import { TerrainBlockDefinitions } from "./TerrainBlockDefinitions.js";

/**
 * A complete, map-authored earth building block.
 */
export class Earth {
  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) { TerrainBlockDefinitions.populate(mapData); }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;

  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() { return EarthSurfaceMaterials.textureUrls; }

  /**
   * @param {Array} args
   */
  static registerMaterials(...args) { EarthSurfaceMaterials.register(...args); }

  /**
   * @param {import("../ObjectTypes.js").MapObjectRuntime} runtime
   */
  static prepareRuntime(runtime) {
    const earth = new EarthSurfaceMaterials(runtime.mapData);
    const grass = new GrassSurfaceMaterials(runtime.mapData);
    const selector = new TerrainMaterialSelector(grass, earth, runtime.sideVariantCount);
    runtime.surfaceMaterials = { earth, grass };
    /**
     * @param {string} value
     */
    runtime.resolveMaterial = (value) => {
      if (typeof value !== "string" || !value.includes(":")) {
        return value;
      }
      const [kind, ...coordinates] = value.split(":");
      const [col, row, level] = coordinates.map(Number);
      switch (kind) {
        case "grass": return grass.topForTile(col, row, level);
        case "earthSide": return earth.sideForTile(col, row, level);
        case "turfSide": return earth.topSideForTile(col, row, level);
        case "overpassSide": return earth.overpassSideForTile(col, row, level);
        case "surface": return selector.cubeMaterials(runtime.mapData.grid[row][col], true, col, row, level).top;
        default: return value;
      }
    };
    runtime.setMaterialResolver?.(runtime.resolveMaterial);
  }

  /**
   * @param {{pc: typeof import("playcanvas"), definition: import("../ObjectTypes.js").MapObjectDefinition, runtime: import("../ObjectTypes.js").MapObjectRuntime}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("../ObjectTypes.js").MapObjectRuntime} options.runtime
   */
  constructor({ pc, definition, runtime }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.object} ${definition.id}`);
    const position = definition.position ?? {
      x: definition.tile.col - (runtime.mapData.cols - 1) / 2,
      y: (definition.level ?? 0) + 0.5,
      z: definition.tile.row - (runtime.mapData.rows - 1) / 2,
    };
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    const geometry = definition.geometry ?? this.defaultGeometry(position, runtime);
    const args = geometry.args.map(runtime.resolveMaterial);
    runtime.instanceRenderer[geometry.method](...args);
  }

  /**
   * @param {import("../ObjectTypes.js").Point3} position
   * @param {import("../ObjectTypes.js").MapObjectRuntime} runtime
   */
  defaultGeometry(position, runtime) {
    const { col, row } = this.#definition.tile ?? {
      col: Math.round(position.x + (runtime.mapData.cols - 1) / 2),
      row: Math.round(position.z + (runtime.mapData.rows - 1) / 2),
    };
    const level = position.y - 0.5;
    return { method: "addCubeMatrix", args: ["earth", `earthSide:${col}:${row}:${level}`, position.x, position.y, position.z, "full", "earth", 0] };
  }

  /**
   * Batched terrain retains the map camera bounds rather than adding per-block pan targets.
   * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() { return []; }
  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("../ObjectTypes.js").GridPoint|undefined}
   */
  get tile() { return this.#definition.tile; }
  destroy() { this.#entity.destroy(); }
}
