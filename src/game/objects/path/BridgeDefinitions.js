import { Mat4, Quat, Vec3 } from "playcanvas";

/**
 * @typedef {{elevation:number, height:number, metadata:{bridgeGroundHeight?:number}}} BridgeGroundTarget
 */
/**
 * Transfers static bridge commands to map objects so each span owns destruction.
 */
export class BridgeDefinitions {
  /**
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static populate(map) {
    const spans = (map.renderCommands ?? []).filter(BridgeDefinitions.#isSpan);
    for (const command of spans) {
      const [span, elevation, material] = command.args;
      const id = `bridge-${span.horizontal ? "x" : "z"}-${span.start}-${span.crossCenter}-${elevation}`;
      const exists = map.objects.some(/**
       * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
       */
        (definition) => definition.id === id);
      if (!exists) {
        map.objects.push({
          id,
          object: "Bridge",
          span,
          elevation,
          material,
          generated: true,
        });
      }
    }
    map.renderCommands = (map.renderCommands ?? []).filter(/**
     *
     * @param {import("../ObjectTypes.js").RenderCommand} command
     */
      (command) => {
        if (BridgeDefinitions.#isSpan(command)) {
          return false;
        }
        if (command.method !== "addBoxMatrix") {
          return true;
        }
        const [, , x, y, z, , , , , coverage] = command.args;
        if (!["surfaceOnly", "bridgeHorizontalSidesOnly", "bridgeVerticalSidesOnly"].includes(coverage)) {
          return true;
        }
        return !spans.some(/**
       *
       * @param {import("../ObjectTypes.js").RenderCommand} options
       */
          (options) => {
            const [span, elevation] = options.args;
            const col = x + (map.cols - 1) / 2;
            const row = z + (map.rows - 1) / 2;
            const along = span.horizontal ? col : row;
            const across = span.horizontal ? row : col;

            return Math.abs(y - (elevation - 0.12)) < 0.001 &&
          Math.abs(across - span.crossCenter) < 0.001 &&
          along >= span.start && along <= span.end;
          });
      });
    BridgeDefinitions.#deriveGroundHeights(map);
  }

  /**
   * Index actual remaining geometry after the deck commands have transferred.
   * An unauthored void receives no replacement floor.
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static #deriveGroundHeights(map) {
    const targets = new Map();
    for (const definition of map.objects ?? []) {
      if (definition.object !== "Bridge") {
        continue;
      }
      for (const cell of definition.span.cells) {
        const metadata = map.tileMeta?.[cell.row]?.[cell.col];
        if (!metadata || metadata.bridgeGroundHeight !== undefined) {
          continue;
        }
        targets.set(`${cell.col},${cell.row}`, {
          elevation: definition.elevation,
          height: -Infinity,
          metadata,
        });
      }
    }
    if (!targets.size) {
      return;
    }
    for (const definition of map.objects ?? []) {
      if (definition.geometry) {
        BridgeDefinitions.#indexGroundGeometry(map, targets, definition.geometry);
      }
    }
    for (const command of map.renderCommands ?? []) {
      BridgeDefinitions.#indexGroundGeometry(map, targets, command);
    }
    for (const target of targets.values()) {
      if (Number.isFinite(target.height)) {
        target.metadata.bridgeGroundHeight = target.height;
      }
    }
  }

  /**
   * @param {import("../../GameContracts.js").GameMapData} map
   * @param {Map<string, BridgeGroundTarget>} targets
   * @param {import("../ObjectTypes.js").RenderCommand} command
   */
  static #indexGroundGeometry(map, targets, command) {
    const args = command.args;
    if (!args || args[0] === "none") {
      return;
    }
    const [,, x, y, z] = args;
    if (command.method === "addCubeMatrix") {
      if ((args[5] ?? "full").endsWith("SidesOnly")) {
        return;
      }
      const col = Math.round(x + (map.cols - 1) / 2);
      const row = Math.round(z + (map.rows - 1) / 2);
      BridgeDefinitions.#retainGround(targets.get(`${col},${row}`), y + 0.5 + (args[7] ?? 0));
    } else if (command.method === "addBoxMatrix" && !(args[9] ?? "full").endsWith("SidesOnly")) {
      BridgeDefinitions.#indexGroundBox(map, targets, args);
    }
  }

  /**
   * Rasterize the actual upward plane of a box, including its yaw and pitch.
   * @param {import("../../GameContracts.js").GameMapData} map
   * @param {Map<string, BridgeGroundTarget>} targets
   * @param {Array<number|string>} args
   */
  static #indexGroundBox(map, targets, args) {
    const [,, x, y, z, yaw, width, height, depth] = args;
    const rotation = new Quat().setFromEulerAngles(args[11] ?? 0, yaw, 0);
    const normal = rotation.transformVector(Vec3.UP);
    if (normal.y < 0.001) {
      return;
    }
    const transform = new Mat4().setTRS(new Vec3(x, y, z), rotation, new Vec3(width, height, depth));
    const inverse = new Mat4().copy(transform).invert();
    const top = transform.transformPoint(new Vec3(0, 0.5, 0));
    const corners = [new Vec3(-0.5, 0.5, -0.5), new Vec3(0.5, 0.5, -0.5),
      new Vec3(0.5, 0.5, 0.5), new Vec3(-0.5, 0.5, 0.5)];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const corner of corners) {
      transform.transformPoint(corner, corner);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }
    const colOffset = (map.cols - 1) / 2;
    const rowOffset = (map.rows - 1) / 2;
    for (let row = Math.max(0, Math.ceil(minZ + rowOffset - 0.000001)); row <= Math.min(map.rows - 1, Math.floor(maxZ + rowOffset + 0.000001)); row++) {
      for (let col = Math.max(0, Math.ceil(minX + colOffset - 0.000001)); col <= Math.min(map.cols - 1, Math.floor(maxX + colOffset + 0.000001)); col++) {
        const target = targets.get(`${col},${row}`);
        if (!target) {
          continue;
        }
        const worldX = col - colOffset;
        const worldZ = row - rowOffset;
        const worldY = top.y - (normal.x * (worldX - top.x) + normal.z * (worldZ - top.z)) / normal.y;
        const local = inverse.transformPoint(new Vec3(worldX, worldY, worldZ));
        if (Math.abs(local.x) <= 0.500001 && Math.abs(local.z) <= 0.500001) {
          BridgeDefinitions.#retainGround(target, worldY);
        }
      }
    }
  }

  /**
   * @param {BridgeGroundTarget|undefined} target
   * @param {number} height
   */
  static #retainGround(target, height) {
    if (target && Number.isFinite(height) && height < target.elevation - 0.24 && height > target.height) {
      target.height = height;
    }
  }

  /**
   * @param {import("../ObjectTypes.js").RenderCommand} command
   * @returns {boolean}
   */
  static #isSpan(command) {
    return command.method === "addSpan";
  }
}
