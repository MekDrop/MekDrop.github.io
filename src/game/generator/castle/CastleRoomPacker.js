import { GenerationRandom } from "../map/GenerationRandom.js";

/**
 * Packs rooms beside a continuous hall with door-leaf and actor clearance with masonry between rooms.
 */
export class CastleRoomPacker {
  /**
   * @type {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom[]}
   */
  rooms = [];
  /**
   * @type {string[]}
   */
  skipped = [];
  /**
   * @type {string|null}
   */
  stairHostRoomId = null;
  /**
   * @type {{minX:number,maxX:number,minZ:number,maxZ:number}}
   */
  bounds;
  /**
   * @type {{minX:number,maxX:number,minZ:number,maxZ:number}}
   */
  shaft;
  /**
   * @type {GenerationRandom}
   */
  #random;
  /**
   * @type {number}
   */
  #baseY;
  /**
   * @type {number}
   */
  #rise;
  /**
   * @type {boolean}
   */
  #compact;

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
   * @param {number} baseY
   * @param {number} rise
   * @param {string|number} seed
   * @param {boolean} [compact]
   */
  constructor(bounds, baseY, rise, seed, compact = false) {
    this.bounds = bounds;
    this.#baseY = baseY;
    this.#rise = rise;
    this.#compact = compact;
    this.#random = new GenerationRandom(`castle:${seed}:rooms`);
    const minX = -bounds.minX >= bounds.maxX ? bounds.minX : bounds.maxX - 3;
    this.shaft = { minX, maxX: minX + 3, minZ: bounds.maxZ - 3, maxZ: bounds.maxZ };
  }

  /**
   * @param {import("./rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator[]} generators
   */
  place(generators) {
    for (const generator of generators) {
      let room = null;
      for (const level of generator.levels) {
        room = this.#placeOnLevel(generator, level);
        if (room) { break; }
      }
      if (room) {
        this.rooms.push(room);
        if (room.stairHost) { this.stairHostRoomId = room.id; }
      }
      else { this.skipped.push(generator.id); }
    }
  }

  /**
   * Absorb empty strips against exterior walls after packing, within each room's
   * size limit. Keep the hall and reserved stair circulation open.
   * @param {import("./rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator[]} generators
   */
  extendRooms(generators) {
    for (const room of this.rooms) {
      if (room.level !== 0 || room.id === "throneRoom" || room.id === "leisure" || room.id.startsWith("tower")) continue;
      const generator = generators.find(/**
       *
       * @param {{id:string}} entry
       */
      (entry) => entry.id === room.id);
      const left = (room.minX + room.maxX) / 2 < 0;
      for (const [key, target] of [[left ? "minX" : "maxX", left ? this.bounds.minX : this.bounds.maxX],
        ["maxZ", this.bounds.maxZ], ...(!room.stairHost ? [["minZ", this.bounds.minZ]] : [])]) {
        const direction = target < room[key] ? -0.25 : 0.25;
        while (Math.abs(target - room[key]) >= 0.249) {
          const candidate = { ...room, [key]: room[key] + direction };
          if (candidate.maxX - candidate.minX > (generator.max?.x ?? Infinity) ||
            candidate.maxZ - candidate.minZ > (generator.max?.y ?? Infinity)) break;
          if (!room.stairHost && CastleRoomPacker.overlaps(candidate, this.shaft, 0.25)) break;
          if (this.rooms.some(/**
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} other
           */
          (other) => other !== room && candidate.level < other.level + other.floorSpan &&
            candidate.level + candidate.floorSpan > other.level && CastleRoomPacker.overlaps(candidate, other,
              other.id.startsWith("tower") ? 1.5 : 0.25))) break;
          room[key] = candidate[key];
        }
      }
    }
  }

  /**
   * @param {import("./rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator} generator
   * @param {number} level
   * @returns {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom|null}
   */
  #placeOnLevel(generator, level) {
    if ((level !== 0 || generator.floorSpan > 1) && !this.stairHostRoomId) { return null; }
    const minW = Math.ceil(generator.min.x * 4);
    const minD = Math.ceil(generator.min.y * 4);
    const maxW = Math.floor(Math.min(generator.max?.x ?? Infinity, this.bounds.maxX - this.bounds.minX) * 4);
    const maxD = Math.floor(Math.min(generator.max?.y ?? Infinity, this.bounds.maxZ - this.bounds.minZ) * 4);
    const candidates = [];
    for (let w = minW; w <= maxW; w++) {
      if (generator.id === "throneRoom" && w % 2 !== 0) { continue; }
      for (let d = minD; d <= maxD; d++) { candidates.push([w / 4, d / 4]); }
    }
    this.#random.shuffle(candidates);
    // Smaller first-pass rooms leave space for later requirements. Expansion
    // happens only after all rooms have had a chance to occupy the footprint.
    if (this.#compact) candidates.sort(/**
     *
     * @param {number[]} a
     * @param {number[]} b
     */
    (a, b) => a[0] * a[1] - b[0] * b[1]);
    // Prefer a stacked keep: upstairs walls bear on an existing room below.
    const foundation = level === 1 ? [...this.rooms].sort(/**
     *
     * @param {{id:string}} a
     * @param {{id:string}} b
     */
    (a, b) => Number(b.id === "throneRoom") - Number(a.id === "throneRoom")).find(/**
     * @param {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */ (room) =>
      room.level === 0 && !room.stairHost &&
      room.maxX - room.minX >= generator.min.x && room.maxZ - room.minZ >= generator.min.y) : null;
    for (const [width, depth] of candidates) {
      if (foundation && (width > foundation.maxX - foundation.minX || depth > foundation.maxZ - foundation.minZ)) { continue; }
      const towerIndex = generator.id.startsWith("tower") ? Number(generator.id.slice(5)) : 0;
      const towerLeft = towerIndex === 1 || towerIndex === 3;
      const towerBack = towerIndex === 3 || towerIndex === 4;
      const xs = foundation ? [(foundation.minX + foundation.maxX - width) / 2] : towerIndex ? [towerLeft ? this.bounds.minX : this.bounds.maxX - width] :
        generator.id === "throneRoom" ? [-width / 2] : [...new Set([
          this.bounds.minX, this.bounds.maxX - width, -1.25 - width, 1.25,
        ])];
      for (const minX of this.#random.shuffle(xs)) {
        const start = foundation ? foundation.minZ : towerBack ? this.bounds.maxZ - depth : this.bounds.minZ;
        const end = foundation ? start : towerIndex || generator.id === "throneRoom" ? start : this.bounds.maxZ - depth;
        for (let minZ = start; minZ <= end + 0.001; minZ += 0.25) {
          let room = { id: generator.id, purpose: generator.id, minX, maxX: minX + width,
            minZ, maxZ: minZ + depth, level, floorSpan: generator.floorSpan, height: 2.25 + (generator.floorSpan - 1) * this.#rise, floorY: this.#baseY + (level < 0 ? -2.5 : level * this.#rise) };
          const host = generator.id === "library" && level === 0;
          const basementHost = generator.id === "service" && level === -1;
          if (host || basementHost) {
            // Extend an existing room, retaining its content area for furnishing.
            // A host stays on one side of the shared hall.
            const contentBounds = { minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ };
            const enlarged = { ...room, minX: Math.min(room.minX, this.shaft.minX),
              maxX: Math.max(room.maxX, this.shaft.maxX), minZ: Math.min(room.minZ, this.shaft.minZ),
              maxZ: Math.max(room.maxZ, this.shaft.maxZ) };
            if (enlarged.minX < 0 && enlarged.maxX > 0) { continue; }
            if (this.shaft.maxX <= 0 ? enlarged.maxX > this.shaft.maxX : enlarged.minX < this.shaft.minX) { continue; }
            if (enlarged.maxX - enlarged.minX > (generator.max?.x ?? Infinity) ||
              enlarged.maxZ - enlarged.minZ > (generator.max?.y ?? Infinity)) { continue; }
            room = { ...enlarged, contentBounds, stairHost: host,
              floorSpan: host ? 2 : 1, height: host ? this.#rise + 2.25 : 2.25 };
          }
          if (room.minX - this.bounds.minX > 0 && room.minX - this.bounds.minX <= 0.5) { room.minX = this.bounds.minX; }
          if (this.bounds.maxX - room.maxX > 0 && this.bounds.maxX - room.maxX <= 0.5) { room.maxX = this.bounds.maxX; }
          if (this.bounds.maxZ - room.maxZ > 0 && this.bounds.maxZ - room.maxZ <= 0.5) { room.maxZ = this.bounds.maxZ; }
          if (room.minX < this.bounds.minX || room.maxX > this.bounds.maxX || room.maxZ > this.bounds.maxZ) { continue; }
          if (!host && !basementHost && !foundation && generator.id !== "throneRoom" &&
            room.minX < 1.25 && room.maxX > -1.25) { continue; }
          if (!host && !basementHost && CastleRoomPacker.overlaps(room, this.shaft, 0.25)) { continue; }
          if (this.rooms.some(/**
           *
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} placed
           */
          (placed) => (room.level < placed.level + placed.floorSpan && room.level + room.floorSpan > placed.level) && CastleRoomPacker.overlaps(room, placed, towerIndex ? 1.5 : 0.25))) { continue; }
          if (level !== 0 && this.shaft.maxX > 0 && this.shaft.minX < 0) { continue; }
          return room;
        }
      }
    }
    return null;
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} a
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} b
   * @param {number} [gap]
   * @returns {boolean}
   */
  static overlaps(a, b, gap = 0) {
    return a.minX < b.maxX + gap - 0.001 && a.maxX > b.minX - gap + 0.001 &&
      a.minZ < b.maxZ + gap - 0.001 && a.maxZ > b.minZ - gap + 0.001;
  }
}

