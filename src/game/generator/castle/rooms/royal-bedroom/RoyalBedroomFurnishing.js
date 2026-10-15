import { RoomPlacementRules } from "../RoomPlacementRules.js";

/**
 * Five compact arrangements using the existing royal bed and castle prop kit.
 * Door swings, furniture approaches and a continuous walking route take priority
 * over optional decoration. No bedroom consumes another room's random stream.
 */
export class RoyalBedroomFurnishing {
  /**
   * @returns {string[]}
   */
  static get variations() {
    return ["quiet-bedroom", "writing-retreat", "reading-nook", "ceremonial-bedroom", "dressing-room"];
  }

  /**
   * @type {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom}
   */
  #room;
  /**
   * @type {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  #items = [];
  /**
   * @type {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>}
   */
  #access = [];
  /**
   * @type {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[]}
   */
  #doors;
  /**
   * @type {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>}
   */
  #stairs;
  /**
   * @type {number}
   */
  #thickness;
  /**
   * @type {number}
   */
  #variant;

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed:string|number,wallThickness:number,openings:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs:Array<{minX:number,maxX:number,minZ:number,maxZ:number}>}} context
   */
  constructor(room, context) {
    this.#room = room;
    this.#doors = context.openings.filter(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */ opening => opening.kind === "door");
    this.#stairs = context.stairs;
    this.#thickness = context.wallThickness;
    let seed = Number(context.seed);
    if (!Number.isFinite(seed)) {
      seed = 0;
      for (const character of `${context.seed}:${room.id}`) { seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0; }
    }
    this.#variant = Math.floor(Math.abs(seed) / 2) % 5;
    const walls = this.#variant === 1 || this.#variant === 3 ? [180, 90, 0, 270] : [90, 180, 270, 0];
    const bed = this.#perimeter("royalBed", 1.2, 1.805, 2.03, walls);
    if (!bed) { return; }
    if (this.#variant === 1) { this.#writingDesk(); }
    const spacious = (room.maxX - room.minX) * (room.maxZ - room.minZ) > 18;
    if (this.#variant === 2 && !spacious) {
      const chair = this.#perimeter("WoodenDeskChair", 0.75, 0.735, 0.85, [90, 0, 270, 180]);
      const table = this.#perimeter("LibrarySideTable", 0.6841, 0.6162, 0.55, [0, 90, 270, 180], chair);
      if (table) { this.#supported("OpenReadingBook", table, 0.36, 0.227, 0.0673); }
    }
    if (this.#variant === 3) { this.#bedside(bed, -1); }
    if (this.#variant === 4) {
      const washstand = this.#perimeter("BedsideDrawers", 0.6004, 0.5604, 0.65, [0, 270, 90, 180]);
      if (washstand) { this.#supported("WoodenWashBasin", washstand, 0.5899, 0.5084, 0.2362); }
    }
    this.#perimeter("wardrobe", 0.65, 0.46, 1.15, [0, 270, 180, 90]);
    const chest = this.#perimeter("WoodenStorageChest", 0.7, 0.55, 0.3291, [180, 0, 270, 90]);
    if (chest && this.#variant === 4) { this.#supported("FoldedLinens", chest, 0.3, 0.22, 0.16); }
    // One desk serves reading and writing; a bookcase and wash cabinet add useful storage.
    if (spacious) {
      const bookshelf = this.#perimeter("Bookshelf", 0.935, 0.36, 1.8, [90, 270, 0, 180]);
      if (bookshelf) { bookshelf.role = "libraryProp"; }
      if (this.#variant !== 1) { this.#writingDesk(); }
      if (this.#variant !== 4) {
        const washstand = this.#perimeter("BedsideDrawers", 0.6004, 0.5604, 0.65, [270, 90, 180, 0]);
        if (washstand) { this.#supported("WoodenWashBasin", washstand, 0.5899, 0.5084, 0.2362); }
      }
      if (bookshelf) { this.#extendBookshelf(bookshelf); }
      if (chest && this.#variant !== 4) { this.#supported("FoldedLinens", chest, 0.3, 0.22, 0.16); }
    }
    this.#picture(bed, context.openings);
    this.#rug(bed);
    for (const item of this.#items) { item.furnishingVariant = RoyalBedroomFurnishing.variations[this.#variant]; }
  }

  /**
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  get items() { return this.#items; }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} bed
   * @param {number} [side]
   */
  #bedside(bed, side = 1) {
    const angle = bed.rotation * Math.PI / 180;
    for (const direction of side === 1 ? [1, -1] : [-1]) {
      const x = bed.x + direction * Math.cos(angle) * 0.95 - Math.sin(angle) * 0.55;
      const z = bed.z - direction * Math.sin(angle) * 0.95 - Math.cos(angle) * 0.55;
      const drawer = this.#place("BedsideDrawers", x, z, 0.6004, 0.5604, 0.65, bed.rotation);
      if (!drawer) { continue; }
      this.#supported("TableCandles", drawer, 0.1407, 0.1916, 0.2311);
      return;
    }
  }

  /**
   * Keep the seat and its approach available before committing the desk.
   */
  #writingDesk() {
    const group = this.#perimeter("deskReserve", 0.9, 1.45, 0.85, [0, 90, 270, 180]);
    if (!group) { return; }
    this.#items.pop();
    const angle = group.rotation * Math.PI / 180;
    const desk = this.#place("WritingDesk", group.x - Math.sin(angle) * 0.45,
      group.z - Math.cos(angle) * 0.45, 0.9, 0.55, 0.65, group.rotation);
    if (!desk) { return; }
    const chair = this.#place("WoodenDeskChair", group.x + Math.sin(angle) * 0.25,
      group.z + Math.cos(angle) * 0.25, 0.43, 0.51, 0.85, (group.rotation + 270) % 360);
    if (chair) { chair.mirrorRotationOffset = 180; }
    this.#supported("DeskParchment", desk, 0.3034, 0.35, 0.0376);
    this.#access.push({ minX: group.x - group.width / 2, maxX: group.x + group.width / 2,
      minZ: group.z - group.depth / 2, maxZ: group.z + group.depth / 2 });
  }

  /**
   * Try complete cardinal layouts; never shrink the bed to make a plan fit.
   * @param {string} object
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number[]} walls
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} [near]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #perimeter(object, width, depth, height, walls, near) {
    const room = this.#room.contentBounds ?? this.#room;
    const inset = this.#thickness / 2 + 0.055;
    const candidates = [];
    for (const rotation of walls) {
      const sideways = rotation % 180 !== 0;
      const halfX = (sideways ? depth : width) / 2;
      const halfZ = (sideways ? width : depth) / 2;
      for (const fraction of [0.8, 0.2, 0.5, 0, 1, 0.65, 0.35]) {
        candidates.push({ rotation,
          x: rotation === 90 ? room.minX + inset + halfX : rotation === 270 ? room.maxX - inset - halfX
            : room.minX + inset + halfX + (room.maxX - room.minX - 2 * (inset + halfX)) * fraction,
          z: rotation === 0 ? room.minZ + inset + halfZ : rotation === 180 ? room.maxZ - inset - halfZ
            : room.minZ + inset + halfZ + (room.maxZ - room.minZ - 2 * (inset + halfZ)) * fraction });
      }
    }
    if (near) {
      candidates.sort(/**
       * @param {{x:number,z:number}} first
       * @param {{x:number,z:number}} second
       */ (first, second) => Math.hypot(first.x - near.x, first.z - near.z) - Math.hypot(second.x - near.x, second.z - near.z));
    }
    for (const candidate of candidates) {
      const item = this.#place(object, candidate.x, candidate.z, width, depth, height, candidate.rotation);
      if (item && object === "royalBed") {
        const before = this.#items.length;
        this.#bedside(item);
        if (this.#items.length === before) { this.#items.pop(); continue; }
      }
      if (item) { return item; }
    }
  }

  /**
   * @param {string} object
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number} rotation
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #place(object, x, z, width, depth, height, rotation) {
    const sideways = rotation % 180 !== 0;
    const item = { id: `${this.#room.id}-royal-${this.#items.length}`, object: /^[A-Z]/.test(object) ? object : undefined,
      role: /^[A-Z]/.test(object) ? "royalBedroomProp" : object, x, z, width: sideways ? depth : width,
      depth: sideways ? width : depth, height, rotation, scale: 1, y: 0 };
    if (!RoomPlacementRules.accepts(item, this.#room, this.#items, this.#thickness)) { return; }
    const bounds = { minX: x - item.width / 2 - 0.05, maxX: x + item.width / 2 + 0.05,
      minZ: z - item.depth / 2 - 0.05, maxZ: z + item.depth / 2 + 0.05 };
    const intersects = /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} area
     */ area => bounds.minX < area.maxX && bounds.maxX > area.minX && bounds.minZ < area.maxZ && bounds.maxZ > area.minZ;
    if (this.#access.some(intersects) || this.#stairs.some(intersects)) { return; }
    for (const door of this.#doors) {
      const crosswise = door.axis === "x";
      const low = crosswise ? this.#room.minX : this.#room.minZ;
      const inward = Math.abs(door.coordinate - low) < this.#thickness ? 1 : -1;
      const swingsIntoRoom = door.swing === undefined || (door.roomId === this.#room.id
        ? door.swing === "inward" : door.swing === "outward");
      const end = door.coordinate + inward * (swingsIntoRoom ? door.width + 0.25 : 0.65);
      const doorBounds = { minX: crosswise ? Math.min(door.coordinate, end) : door.center - door.width / 2 - 0.15,
        maxX: crosswise ? Math.max(door.coordinate, end) : door.center + door.width / 2 + 0.15,
        minZ: crosswise ? door.center - door.width / 2 - 0.15 : Math.min(door.coordinate, end),
        maxZ: crosswise ? door.center + door.width / 2 + 0.15 : Math.max(door.coordinate, end) };
      if (intersects(doorBounds)) { return; }
    }
    this.#items.push(item);
    if (!this.#connected()) { this.#items.pop(); return; }
    return item;
  }

  /**
   * Flood the usable floor at an adult actor's clearance before accepting a prop.
   * @returns {boolean}
   */
  #connected() {
    const room = this.#room;
    const clearance = 0.3;
    const columns = Math.max(2, Math.ceil((room.maxX - room.minX) / 0.2));
    const rows = Math.max(2, Math.ceil((room.maxZ - room.minZ) / 0.2));
    const points = [];
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) {
        const x = room.minX + clearance + col / columns * (room.maxX - room.minX - 2 * clearance);
        const z = room.minZ + clearance + row / rows * (room.maxZ - room.minZ - 2 * clearance);
        points.push({ x, z, free: !this.#items.some(/**
         * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
         */ item => Math.abs(x - item.x) < item.width / 2 + clearance && Math.abs(z - item.z) < item.depth / 2 + clearance) &&
          !this.#stairs.some(/**
           * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} stair
           */ stair => x > stair.minX - clearance && x < stair.maxX + clearance && z > stair.minZ - clearance && z < stair.maxZ + clearance) });
      }
    }
    const door = this.#doors[0];
    const targetX = door?.axis === "x" ? door.coordinate : door?.center ?? (room.minX + room.maxX) / 2;
    const targetZ = door?.axis === "z" ? door.coordinate : door?.center ?? (room.minZ + room.maxZ) / 2;
    let first = -1, distance = Infinity;
    for (const [index, point] of points.entries()) {
      const nextDistance = Math.hypot(point.x - targetX, point.z - targetZ);
      if (point.free && nextDistance < distance) { first = index; distance = nextDistance; }
    }
    if (first < 0) { return false; }
    const reached = new Set([first]);
    const queue = [first];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      for (const next of [index - columns - 1, index + columns + 1,
        ...(index % (columns + 1) > 0 ? [index - 1] : []), ...(index % (columns + 1) < columns ? [index + 1] : [])]) {
        if (points[next]?.free && !reached.has(next)) { reached.add(next); queue.push(next); }
      }
    }
    // Tiny inaccessible pockets behind furniture are irrelevant; every doorway
    // and a usable side of the bed must belong to the same reachable component.
    for (const door of this.#doors) {
      if (!queue.some(/**
       * @param {number} index
       */ index => Math.abs((door.axis === "x" ? points[index].x : points[index].z) - door.coordinate) < 0.6 &&
        Math.abs((door.axis === "x" ? points[index].z : points[index].x) - door.center) < door.width / 2 - 0.15)) { return false; }
    }
    const bed = this.#items.find(/**
     * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
     */ item => item.role === "royalBed");
    return !bed || queue.some(/**
     * @param {number} index
     */ index => bed.rotation % 180 === 0
      ? Math.abs(points[index].z - bed.z) < bed.depth / 2 - 0.15 && Math.abs(points[index].x - bed.x) < bed.width / 2 + 0.65
      : Math.abs(points[index].x - bed.x) < bed.width / 2 - 0.15 && Math.abs(points[index].z - bed.z) < bed.depth / 2 + 0.65);
  }

  /**
   * @param {string} object
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} support
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   */
  #supported(object, support, width, depth, height) {
    const sideways = support.rotation % 180 !== 0;
    const item = { id: `${support.id}-${object}`, role: "royalBedroomProp", object, supportId: support.id,
      x: support.x, z: support.z, y: support.height, width: sideways ? depth : width,
      depth: sideways ? width : depth, height, rotation: support.rotation, scale: 1 };
    if (RoomPlacementRules.accepts(item, this.#room, this.#items, this.#thickness)) { this.#items.push(item); }
  }

  /**
   * Grow a continuous modular row up to furniture, door swings or the wall end.
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} first
   */
  #extendBookshelf(first) {
    const sideways = first.rotation % 180 !== 0;
    for (const direction of [1, -1]) {
      let previous = first;
      for (let step = 1; step <= 3; step++) {
        let next;
        const previousLength = sideways ? previous.depth : previous.width;
        for (const length of [0.935, 0.8, 0.6]) {
          const offset = direction * (previousLength + length) / 2;
          next = this.#place("Bookshelf", previous.x + (sideways ? 0 : offset),
            previous.z + (sideways ? offset : 0), length, 0.36, 1.8, first.rotation);
          if (next) { break; }
        }
        if (!next) { break; }
        next.role = "libraryProp";
        previous = next;
      }
    }
  }

  /**
   * Hang the bedroom's own painting on the wall facing the bed.
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} bed
   * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[]} openings
   */
  #picture(bed, openings) {
    const bounds = this.#room.wallBounds ?? this.#room;
    const rotation = (bed.rotation + 180) % 360;
    const sideways = rotation % 180 !== 0;
    const inset = this.#thickness / 2 + 0.032;
    for (const offset of [0, 0.35, -0.35, 0.7, -0.7]) {
      const x = sideways ? rotation === 90 ? bounds.minX + inset : bounds.maxX - inset : bed.x + offset;
      const z = !sideways ? rotation === 0 ? bounds.minZ + inset : bounds.maxZ - inset : bed.z + offset;
      const item = { id: this.#room.id + "-bedroom-painting", role: "royalBedroomProp", object: "Painting", variant: "royal-bedroom", wallMountBack: -0.024,
        x, z, y: 1.3, rotation, width: sideways ? 0.083 : 1.05, depth: sideways ? 1.05 : 0.083,
        height: 0.78, scale: 1, wallAttachment: true };
      if (!RoomPlacementRules.accepts(item, this.#room, this.#items, this.#thickness)) { continue; }
      if (openings.some(/**
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */ opening => opening.axis === (sideways ? "x" : "z") &&
        Math.abs(opening.coordinate - (sideways ? x : z)) < 0.3 &&
        Math.abs(opening.center - (sideways ? z : x)) < opening.width / 2 + 0.6 &&
        (opening.bottom ?? 0) < 2.08 && (opening.bottom ?? 0) + opening.height > 1.3)) { continue; }
      this.#items.push(item);
      return;
    }
  }

  /**
   * A flat rug may share the bed's floor footprint without obstructing walking.
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} bed
   */
  #rug(bed) {
    const room = this.#room;
    if ((room.maxX - room.minX) * (room.maxZ - room.minZ) > 18) {
      const sideways = room.maxX - room.minX > room.maxZ - room.minZ;
      const rug = { id: bed.id + "-royal-rug", role: "royalBedroomProp", object: "RoyalBedroomRug",
        x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2,
        width: sideways ? 2.3 : 1.7, depth: sideways ? 1.7 : 2.3, height: 0.018,
        scale: 1, rotation: sideways ? 90 : 0, y: 0.003, floorCovering: true };
      if (RoomPlacementRules.accepts(rug, room, [], this.#thickness)) { this.#items.push(rug); }
      return;
    }
    const angle = bed.rotation * Math.PI / 180;
    const x = bed.x + Math.sin(angle) * 0.85, z = bed.z + Math.cos(angle) * 0.85;
    const sideways = bed.rotation % 180 !== 0;
    const rug = { id: `${bed.id}-rug`, role: "royalBedroomProp", object: "WovenRug", x, z,
      width: sideways ? 0.75 : 1.2, depth: sideways ? 1.2 : 0.75, height: 0.025,
      scale: 1, rotation: bed.rotation, y: 0.003, floorCovering: true };
    if (RoomPlacementRules.accepts(rug, this.#room, [], this.#thickness)) { this.#items.push(rug); }
  }
}
