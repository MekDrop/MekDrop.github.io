import { Vec2 } from "playcanvas";
import { GenerationRandom } from "../../../map/GenerationRandom.js";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { CASTLE_TERRACE_STYLE } from "../../../../enum/CastleTerraceStyle.js";

/**
 * Two inhabited terrace arrangements with a permanent central tower approach.
 * Dimensions are the authored model footprints in metres, before castle transforms.
 */
export class GardenTerraceRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() {
    super("garden-terrace", new Vec2(11.1, 5));
  }

  /**
   * Keep mirrored even/odd seeds in the same decorative family.
   * @param {string|number} [seed]
   * @returns {string}
   */
  static styleFor(seed = 0) {
    const value = GardenTerraceRoomGenerator.#seedNumber(seed);

    return Math.floor(value / 2) % 2 === 0
      ? CASTLE_TERRACE_STYLE.ROYAL_GARDEN : CASTLE_TERRACE_STYLE.STORYBOOK;
  }

  /**
   * Move the complete seating group between bays, preserving the tower approach.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room) {
    const width = room.maxX - room.minX;
    if (width < this.min.x || room.maxZ - room.minZ < this.min.y) {
      return [];
    }
    const storybook = GardenTerraceRoomGenerator.styleFor(room.furnishingSeed) === CASTLE_TERRACE_STYLE.STORYBOOK;
    // Bay choice is independent of decorative style and shared by mirrored pairs.
    const rightBay = Math.floor(GardenTerraceRoomGenerator.#seedNumber(room.furnishingSeed) / 4) % 2 === 1;
    const bayCenter = Math.min(3, (width - 2) / 4);
    const x = rightBay ? room.maxX - bayCenter : room.minX + bayCenter;
    const z = (room.minZ + room.maxZ) / 2;
    const shelterId = `${room.id}-garden-shelter`;
    const tableId = `${room.id}-garden-table`;
    const items = [this.#item("GardenShelter", x, z, 4.2, 3.62, {
      id: shelterId,
      height: 2.85,
      variant: storybook ? "canopy" : "pergola",
    }), this.#item("Table", x, z, storybook ? 2.1 : 1.15, 0.9, {
      id: tableId,
      supportId: shelterId,
      underSupport: true,
      height: 0.73,
      properties: {
        width: storybook ? 2.1 : 1.15,
        depth: 0.9,
        height: 0.73,
      },
    })];
    if (storybook) {
      items.push(this.#item("Bench", x, z - 1.05, 1.8, 1.05, {
        scale: 1,
        variant: "island",
        supportId: shelterId,
        underSupport: true,
        rotation: 0,
      }), this.#item("Bench", x, z + 1.05, 1.8, 1.05, {
        variant: "island",
        supportId: shelterId,
        underSupport: true,
        rotation: 180,
      }));
    } else {
      items.push(this.#item("Chair", x - 1.15, z, 0.6, 0.6, {
        supportId: shelterId,
        underSupport: true,
        rotation: -90,
      }), this.#item("Chair", x + 1.15, z, 0.6, 0.6, {
        supportId: shelterId,
        underSupport: true,
        rotation: 90,
      }));
    }
    items.push(this.#item("Teapot", x, z, 0.8, 0.4, {
      supportId: tableId,
      elevation: 0.73,
      scale: 0.75,
      height: 0.472,
    }), this.#item("Teacup", x - 0.38, z + 0.29, 0.43, 0.37, {
      supportId: tableId,
      elevation: 0.73,
      scale: 0.75,
      height: 0.217,
    }), this.#item("Teacup", x + 0.38, z - 0.29, 0.43, 0.37, {
      supportId: tableId,
      elevation: 0.73,
      scale: 0.75,
      height: 0.217,
    }));
    // Grounded planters sit inside the parapet, never on an unsupported merlon.
    for (const offset of [1, 4.9, 10.5, 14.25]) {
      if (offset > room.maxX - room.minX - 0.5) {
        continue;
      }
      const planterX = rightBay ? room.maxX - offset : room.minX + offset;
      if (Math.abs(planterX - (room.minX + room.maxX) / 2) < 1.35) {
        continue;
      }
      items.push(this.#item("Planter", planterX, room.maxZ - 0.75, 0.7, 0.7, {
        variant: "flowers",
        height: 1,
      }));
    }
    const oppositeEdge = rightBay ? room.minX + 0.85 : room.maxX - 0.85;
    items.push(this.#item("Planter", oppositeEdge, room.minZ + 0.85, 0.7, 0.7, {
      variant: "flowers",
      height: 1,
    }), this.#item(storybook ? "Barrel" : "Planter", oppositeEdge, z, 0.7, 0.7, {
      variant: storybook ? undefined : "flowers",
      height: 1,
      properties: storybook ? { weathering: 0.55 } : {},
    }));

    return items;
  }

  /**
   * @param {string|number} [seed]
   * @returns {number}
   */
  static #seedNumber(seed = 0) {
    const numeric = Number(seed);

    return Number.isFinite(numeric) ? Math.abs(Math.trunc(numeric))
      : new GenerationRandom(`${seed}:terrace`).rng(0, 2147483646);
  }

  /**
   * @param {string} object
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @param {Partial<import("../AbstractCastleRoomGenerator.js").RoomItem>} [details]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem}
   */
  #item(object, x, z, width, depth, details = {}) {
    return {
      role: "leisureProp",
      object,
      x,
      z,
      width,
      depth,
      scale: 1,
      rotation: 0,
      ...details,
    };
  }
}
