/**
 * @typedef {{minX:number,maxX:number,minZ:number,maxZ:number}} StudyBounds
 * @typedef {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom & {seed?:string|number,furnishingSeed?:string|number,wallThickness?:number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:(StudyBounds & {to?:number,radius?:number,flightShift?:number})[]}} StudyRoom
 */

/**
 * Wall-side study groups reserve their chair/shelf approaches before details.
 * Model footprints are measured GLB envelopes; all dimensions are metres.
 */
export class LibraryRoomFurnishing {
  /**
   * @type {StudyRoom}
   */
  #room;
  /**
   * @type {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  #items = [];
  /**
   * @type {StudyBounds[]}
   */
  #occupied = [];
  /**
   * @type {(StudyBounds & {alongX:boolean})[]}
   */
  #shelfAisles = [];
  /**
   * @type {number}
   */
  #state = 2166136261;
  /**
   * @type {number}
   */
  #inset;
  /**
   * @type {number}
   */
  #shelfCount = 0;
  /**
   * @type {number}
   */
  #topOffset = 0;

  /**
   * @param {StudyRoom} room
   */
  constructor(room) {
    this.#room = room;
    this.#inset = (room.wallThickness ?? 0.25) / 2 + 0.06;
    for (const char of `${room.seed ?? room.furnishingSeed ?? 0}:library:${room.id}:${room.level}`) {
      this.#state = Math.imul(this.#state ^ char.charCodeAt(0), 16777619) >>> 0;
    }
    const sides = [0, 90, 180, 270];
    this.#topOffset = this.#state % 4;
    for (let index = 3; index > 0; index--) {
      const next = Math.floor(this.#random() * (index + 1));
      [sides[index], sides[next]] = [sides[next], sides[index]];
    }
    // Furnish the solid end wall first, so the desk cannot consume the
    // bookcase row. Neighbouring cases share their reading aisle.
    this.#shelves([90], 4);
    let desk;
    for (const yaw of sides) {
      for (const along of this.#positions(yaw)) {
        const group = this.#point(yaw, along, 0.85);
        const width = yaw % 180 ? 1.7 : 1.05, depth = yaw % 180 ? 1.05 : 1.7;
        if (!this.#clear(group, width, depth, 1.1)) { continue; }
        // Keep a 1 cm gap to the actual wall, like the neighbouring bookcases.
        desk = this.#item("WritingDesk", this.#point(yaw, along, 0.285, true), 0.9, 0.55, yaw);
        // Both imported chairs face -X (their tall backs sit on +X).
        this.#items.push(desk, this.#item("Chair", this.#point(yaw, along, 0.91, true), 0.43, 0.51, (yaw + 270) % 360));
        this.#reserve(group, width, depth);
        break;
      }
      if (desk) { break; }
    }
    if (desk) {
      const angle = desk.rotation * Math.PI / 180;
      /**
       * @param {number} x
       * @param {number} z
       * @returns {{x:number,z:number}}
       */
      const top = (x, z) => ({
        x: desk.x + x * Math.cos(angle) + z * Math.sin(angle),
        z: desk.z - x * Math.sin(angle) + z * Math.cos(angle),
      });
      // Measured desktop top .650. Replace baked details so reflection cannot
      // put the globe through the original asymmetrically placed ink pot.
      this.#items.push(this.#item("Book", top(0.01, 0.02), 0.36, 0.227, desk.rotation, 0.650, {isOpen: true}));
      if (this.#random() < 0.85) { this.#items.push(this.#item("DeskGlobe", top(-0.305, -0.07), 0.24, 0.285, desk.rotation, 0.650)); }
      if (this.#random() < 0.8) { this.#items.push(this.#item("CandleStand", top(0.29, 0.115), 0.141, 0.192, desk.rotation, 0.650, {variant: "table"})); }
    }
    this.#shelves(sides, 1);
    // Use every remaining safe wall slot rather than stopping at a random
    // bookcase count. Shared aisles still preserve the room's access routes.
    this.#shelves(sides, Infinity);
    if (desk) {
      stool: for (const yaw of sides) {
        for (const along of this.#positions(yaw)) {
          const original = this.#point(yaw, along, 0.26);
          const width = yaw % 180 ? 0.488 : 0.517, depth = yaw % 180 ? 0.517 : 0.488;
          if (!this.#clear(original, width, depth, 0.4)) { continue; }
          const bounds = this.#room.wallBounds ?? this.#room.contentBounds ?? this.#room;
          const stair = (this.#room.stairs ?? []).find(
            this.#findShaft.bind(this),
          );
          // The marked corner is the SOUTH window wall meeting the stair
          // opening guard, not an outer corner of the room. The guard's
          // library-side face is one radius plus flight shift from its centre.
          const guardX = stair ? (stair.minX + stair.maxX) / 2 -
            (stair.radius ?? (stair.maxX - stair.minX) / 2 - 0.025) - (stair.flightShift ?? 0) : undefined;
          const target = stair ? {
            x: guardX - width / 2 - 0.01,
            z: bounds.maxZ - depth / 2 - 0.01,
          } : original;
          const point = this.#clear(target, width, depth, 0.4, 0, false, undefined, true) ? target : original;
          this.#items.push(this.#item("StepStool", point, 0.517, 0.488, yaw));
          this.#reserve(point, width, depth);
          break stool;
        }
      }
    }
    if (!desk) {
      return;
    }
    // Floor candle beside the reading furniture, with its base clear of
    // the table, chair, bookcase aisle and door approach.
    this.#occupied = [];
    for (const item of this.#items) {
      if (item.y === 0) { this.#reserve(item, item.width + 0.06, item.depth + 0.06); }
    }
    for (const table of this.#items) {
      if (!["WritingDesk"].includes(table.object)) { continue; }
      const angle = table.rotation * Math.PI / 180;
      for (const forward of [0, 0.35, 0.6]) {
        for (const offset of [-0.58, 0.58, -0.72, 0.72]) {
          const point = {
            x: table.x + offset * Math.cos(angle) + forward * Math.sin(angle),
            z: table.z - offset * Math.sin(angle) + forward * Math.cos(angle),
          };
          if (!this.#clear(point, 0.173, 0.173, 0.8)) { continue; }
          this.#items.push(this.#item("CandleStand", point, 0.173, 0.173, table.rotation, undefined, {variant: "single"}));

          return;
        }
      }
    }
  }
  /**
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  get items() { return this.#items; }
  /**
   * @param {number[]} sides
   * @param {number} wanted
   */
  #shelves(sides, wanted) {
    let count = 0;
    for (const yaw of sides) {
      for (const along of this.#shelfPositions(yaw)) {
        const length = yaw === 90 ? 0.79 : 0.85;
        const access = this.#point(yaw, along, 0.6);
        const width = yaw % 180 ? 1.2 : length, depth = yaw % 180 ? length : 1.2;
        // Align the cabinet body to the actual wall, including exterior
        // walls whose building envelope extends beyond the room rectangle.
        const shelfPoint = this.#point(yaw, along, 0.18 - this.#inset);
        const wall = this.#room.wallBounds ?? this.#room;
        const roomBounds = this.#room.contentBounds ?? this.#room;
        if (yaw === 90) { shelfPoint.x += wall.minX - roomBounds.minX; }
        else if (yaw === 270) { shelfPoint.x += wall.maxX - roomBounds.maxX; }
        else if (yaw === 0) { shelfPoint.z += wall.minZ - roomBounds.minZ; }
        else { shelfPoint.z += wall.maxZ - roomBounds.maxZ; }
        const height = Math.min(2.5, this.#room.height - 0.35);
        if (!this.#clear(access, width, depth, height, 0, true, shelfPoint)) { continue; }
        this.#items.push({
          ...this.#item("Bookshelf", shelfPoint, length, 0.36, yaw),
          height,
        });
        const angle = yaw * Math.PI / 180;
        const decoration = (this.#shelfCount++ + this.#topOffset) % 4;
        const offset = decoration === 3 ? 0.22 : ((this.#shelfCount % 3) - 1) * 0.12;
        if (decoration & 1) {
          this.#items.push(this.#item("LibraryBookStack", {
            x: shelfPoint.x - offset * Math.cos(angle),
            z: shelfPoint.z + offset * Math.sin(angle),
          }, 0.26, 0.20, yaw, height));
        }
        if (decoration & 2) {
          this.#items.push(this.#item("ParchmentBundle", {
            x: shelfPoint.x + offset * Math.cos(angle),
            z: shelfPoint.z - offset * Math.sin(angle),
          }, 0.30, 0.156, yaw, height));
        }
        this.#reserve(shelfPoint, yaw % 180 ? 0.36 : length, yaw % 180 ? length : 0.36);
        this.#shelfAisles.push({
          minX: access.x - width / 2,
          maxX: access.x + width / 2,
          minZ: access.z - depth / 2,
          maxZ: access.z + depth / 2,
          alongX: width < depth,
        });
        if (++count >= wanted) { break; }
      }
      if (count >= wanted) { break; }
    }
  }
  /**
   * @param {number} yaw
   * @returns {number[]}
   */
  #shelfPositions(yaw) {
    const bounds = this.#room.wallBounds ?? this.#room.contentBounds ?? this.#room;
    const min = yaw % 180 ? bounds.minZ : bounds.minX;
    const max = yaw % 180 ? bounds.maxZ : bounds.maxX;
    const values = [];
    const half = yaw === 90 ? 0.395 : 0.425;
    for (let along = min + half + 0.01; along <= max - half - 0.01; along += half * 2 + 0.001) { values.push(along); }
    // A desk can leave a usable gap between the regular module positions.
    // Check those gaps too, after the adjoining row has been placed.
    for (let along = min + half + 0.01; along <= max - half - 0.01; along += 0.1) { values.push(along); }

    return values;
  }
  /**
   * @returns {number}
   */
  #random() {
    this.#state = (Math.imul(this.#state, 1664525) + 1013904223) >>> 0;

    return this.#state / 4294967296;
  }
  /**
   * @param {number} yaw
   * @returns {number[]}
   */
  #positions(yaw) {
    const bounds = this.#room.contentBounds ?? this.#room;
    const min = yaw % 180 ? bounds.minZ : bounds.minX;
    const max = yaw % 180 ? bounds.maxZ : bounds.maxX;
    const values = [];
    for (let along = min + this.#inset + 0.6; along < max - this.#inset - 0.6; along += 0.45) { values.push(along); }
    const start = Math.floor(this.#random() * Math.max(1, values.length));

    return values.slice(start).concat(values.slice(0, start));
  }
  /**
   * @param {number} yaw
   * @param {number} along
   * @param {number} inward
   * @param {boolean} [wallAligned]
   * @returns {{x:number,z:number}}
   */
  #point(yaw, along, inward, wallAligned = false) {
    const bounds = (wallAligned ? this.#room.wallBounds : undefined) ?? this.#room.contentBounds ?? this.#room;
    const inset = wallAligned ? 0 : this.#inset;
    if (yaw === 0) { return {
      x: along,
      z: bounds.minZ + inset + inward,
    }; }
    if (yaw === 180) { return {
      x: along,
      z: bounds.maxZ - inset - inward,
    }; }
    if (yaw === 90) { return {
      x: bounds.minX + inset + inward,
      z: along,
    }; }
    return {
      x: bounds.maxX - inset - inward,
      z: along,
    };
  }
  /**
   * @param {string} object
   * @param {{x:number,z:number}} point
   * @param {number} width
   * @param {number} depth
   * @param {number} rotation
   * @param {number} [y]
   * @param {Partial<import("../../../objects/ObjectTypes.js").MapObjectDefinition>} [properties]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem}
   */
  #item(object, point, width, depth, rotation, y = 0, properties = {}) {
    return {
      role: "libraryProp",
      object,
      properties,
      ...point,
      width: rotation % 180 ? depth : width,
      depth: rotation % 180 ? width : depth,
      rotation,
      scale: 1,
      y,
      // Reflection of an X-facing asset requires the opposite yaw correction
      // from the standard Z-facing models. Keep its natural positive scale.
      mirrorRotationOffset: ["Chair", "Throne"].includes(object) ? 180 : 0,
    };
  }
  /**
   * @param {{x:number,z:number}} point
   * @param {number} width
   * @param {number} depth
   */
  #reserve(point, width, depth) {
    this.#occupied.push({
      minX: point.x - width / 2,
      maxX: point.x + width / 2,
      minZ: point.z - depth / 2,
      maxZ: point.z + depth / 2,
    });
  }
  /**
   * @param {{x:number,z:number}} point
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number} [y]
   * @param {boolean} [sharedShelfAisle]
   * @param {{x:number,z:number}} [shelfPoint]
   * @param {boolean} [cornerProp]
   * @returns {boolean}
   */
  #clear({ x, z }, width, depth, height, y = 0, sharedShelfAisle = false, shelfPoint, cornerProp = false) {
    const room = this.#room, bounds = sharedShelfAisle || cornerProp ? room.wallBounds ?? room.contentBounds ?? room : room.contentBounds ?? room;
    const inset = cornerProp ? 0.01 : sharedShelfAisle ? 0 : y >= 1.8 ? this.#inset - 0.06 : this.#inset;
    const box = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    };
    if (box.minX < bounds.minX + inset - 1e-6 || box.maxX > bounds.maxX - inset + 1e-6 ||
        box.minZ < bounds.minZ + inset - 1e-6 || box.maxZ > bounds.maxZ - inset + 1e-6) { return false; }
    const aisles = sharedShelfAisle ? this.#shelfAisles.filter(/**
     * @param {StudyBounds & {alongX:boolean}} aisle
     */
      aisle => aisle.alongX !== (width < depth)) : this.#shelfAisles;
    for (const other of this.#occupied.concat(aisles)) {
      if (box.maxX > other.minX && box.minX < other.maxX && box.maxZ > other.minZ && box.minZ < other.maxZ) { return false; }
    }
    for (const opening of room.openings ?? []) {
      // A reading aisle can share the doorway approach when the cabinet
      // itself ends outside the aperture; keep the door passage unobstructed.
      if (opening.kind === "door" && shelfPoint) {
        const along = opening.axis === "x" ? shelfPoint.z : shelfPoint.x;
        const shelfWidth = width > depth ? 0.36 : 0.85;
        const shelfDepth = width > depth ? 0.85 : 0.36;
        const halfShelf = opening.axis === "x" ? shelfDepth / 2 : shelfWidth / 2;
        if (Math.abs(along - opening.center) >= opening.width / 2 + halfShelf) { continue; }
      }
      if (opening.kind === "window" && (height + y <= opening.bottom || y >= opening.bottom + opening.height)) { continue; }
      const half = Math.max(opening.width, opening.kind === "door" ? 0.75 : 0) / 2 + 0.35;
      const approach = opening.kind === "door" ? Math.max(1.1, opening.width + 0.35) : this.#inset + 0.1;
      if (opening.axis === "x" ? Math.abs(x - opening.coordinate) < width / 2 + approach &&
          Math.abs(z - opening.center) < depth / 2 + half : Math.abs(z - opening.coordinate) < depth / 2 + approach &&
          Math.abs(x - opening.center) < width / 2 + half) { return false; }
    }
    for (const stair of room.stairs ?? []) {
      // The low corner stool can occupy the wall strip outside the shaft;
      // taller furniture still reserves the wider staircase approach.
      const clearance = cornerProp ? 0 : 0.4;
      if (box.maxX > stair.minX - clearance && box.minX < stair.maxX + clearance &&
          box.maxZ > stair.minZ - clearance && box.minZ < stair.maxZ + clearance) { return false; }
    }

    return true;
  }

  /**
   * @param {StudyBounds & {to?:number}} shaft
   */
  #findShaft(shaft) {
    return shaft.to === this.#room.level;
  }
}
