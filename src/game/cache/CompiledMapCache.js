import { Mat4, Quat, Vec3 } from "playcanvas";
import { ObjectDataCache } from "./ObjectDataCache.js";
import { IslandCellOwnership } from "../objects/shared/IslandCellOwnership.js";
import { CUBE_SCALE } from "../rendering/terrain/TerrainMaterialMaps.js";

/**
 * Map-owned render preparation. Contains no entities, materials, or GPU resources.
 */
export class CompiledMapCache {
  /**
   * @param {import("../GameContracts.js").GameMapData} map
   * @param {boolean} [enabled]
   */
  static prepare(map, enabled = true) {
    if (!enabled) {
      delete map.compiledMap;

      return;
    }
    const input = this.input(map);
    map.compiledMap = ObjectDataCache.resolve("compiled-maps", input, () => this.#compile(map, input));
  }

  /**
   * Only inputs affecting instance transforms and island ownership belong here.
   * @param {import("../GameContracts.js").GameMapData} map
   * @returns {import("./ObjectDataCache.js").CacheValue}
   */
  static input(map) {
    return {
      cols: map.cols,
      rows: map.rows,
      geometries: (map.objects ?? []).map(CompiledMapCache.#geometry).filter(Boolean),
      commands: map.renderCommands ?? [],
      islands: map.islandConnectorData ?? null,
      rivers: map.riverData ?? [],
    };
  }

  /**
   * Reject stale preparation after map edits or object replacement.
   * @param {import("../GameContracts.js").GameMapData} map
   * @returns {boolean}
   */
  static matches(map) {
    return Boolean(map.compiledMap) && map.compiledMap.sourceKey === ObjectDataCache.key(this.input(map));
  }

  /**
   * @param {import("../objects/ObjectTypes.js").MapObjectDefinition} definition
   */
  static #geometry(definition) {
    return definition.geometry;
  }

  /**
   * @param {import("../GameContracts.js").GameMapData} map
   * @param {import("./ObjectDataCache.js").CacheValue} input
   * @returns {CompiledMapLayout}
   */
  static #compile(map, input) {
    const islandCells = new IslandCellOwnership(map).groups;
    const transforms = {};
    for (const command of [...input.geometries, ...input.commands]) {
      if (command.method !== "addCubeMatrix" && command.method !== "addBoxMatrix") {
        continue;
      }
      const args = command.args;
      let parameters;
      if (command.method === "addCubeMatrix") {
        const lift = args[8] ?? 0;
        parameters = [args[2], args[3] + lift / 2, args[4], 0, CUBE_SCALE, CUBE_SCALE + lift, CUBE_SCALE, 0];
      } else {
        parameters = [args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[11] ?? 0];
      }
      const key = parameters.join(",");
      if (Object.hasOwn(transforms, key)) {
        continue;
      }
      const [x, y, z, yaw, sx, sy, sz, pitch] = parameters;
      const rotation = new Quat().setFromEulerAngles(pitch, yaw, 0);
      const matrix = new Mat4().setTRS(new Vec3(x, y, z), rotation, new Vec3(sx, sy, sz));
      const col = Math.round(x + (map.cols - 1) / 2);
      const row = Math.round(z + (map.rows - 1) / 2);
      const cell = `${col},${row}`;
      const group = islandCells.findIndex(/**
       *
       * @param {Set<string>} cells
       */
        (cells) => cells.has(cell));
      transforms[key] = {
        matrix: Array.from(matrix.data),
        group,
      };
    }

    return {
      sourceKey: ObjectDataCache.key(input),
      islandCells: islandCells.map(CompiledMapCache.#cells),
      transforms,
    };
  }

  /**
   * @param {Set<string>} cells
   * @returns {string[]}
   */
  static #cells(cells) {
    return [...cells];
  }
}

/**
 * @typedef {{sourceKey:string,islandCells:string[][],transforms:Record<string,{matrix:number[],group:number}>}} CompiledMapLayout
 */
