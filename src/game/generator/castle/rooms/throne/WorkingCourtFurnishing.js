/**
 * @typedef {import("../AbstractCastleRoomGenerator.js").RoomItem} CourtItem
 * @typedef {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} CourtRoom
 * @typedef {{openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{minX:number,maxX:number,minZ:number,maxZ:number,from:number,to:number}>}} CourtContext
 */

/**
 * A working court for larger halls, with a supported desk group and clear aisle.
 */
export class WorkingCourtFurnishing {
  /**
   * @type {CourtItem[]}
   */
  #items = [];
  /**
   * @type {CourtRoom}
   */
  #room;
  /**
   * @type {CourtContext}
   */
  #context;
  /**
   * @type {number}
   */
  #center;

  /**
   * @param {CourtRoom} room
   * @param {CourtContext} context
   */
  constructor(room, context) {
    this.#room = room;
    this.#context = context;
    this.#center = (room.minX + room.maxX) / 2;
    const rear = room.minZ;
    const dais = this.#add("ThroneDais", this.#center, rear + 0.65, 1.1, 0.95);
    dais.height = 0.1;
    this.#add("RoyalCrest", this.#center, rear + 0.2, 1, 0.1, 2.1).scale = 0.7;
    this.#rearGroup(-1);
    this.#rearGroup(1);
    this.#corner(-1);
    this.#corner(1);
    // Work on the side opposite an east door. Every group is tested as a unit.
    const eastDoor = (context.openings ?? []).some(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */
      opening => opening.kind === "door" && opening.roomId === room.id && opening.side === "EAST");
    const side = eastDoor ? -1 : 1;
    this.#desk(side);
    this.#bench(-side, rear + 2);
    this.#bench(-side, rear + 3.55);
    const chestX = side < 0 ? room.minX + 0.45 : room.maxX - 0.45;
    if (this.#fits(chestX, rear + 1.65, 0.65, 0.5)) {
      this.#add("Chest", chestX, rear + 1.65, 0.65, 0.5);
    }
    this.#bookcase(side);
  }

  /**
   * @returns {CourtItem[]}
   */
  get items() {
    return this.#items;
  }

  /**
   * Keep the cabinet ahead of the desk and reserve standing room at its face.
   * @param {number} side
   */
  #bookcase(side) {
    const room = this.#room;
    const x = side < 0 ? room.minX + 0.38 : room.maxX - 0.38;
    const z = room.maxZ - 0.75;
    const approachX = x - side * 0.68;
    if (!this.#fits(x, z, 0.36, 0.85) || !this.#fits(approachX, z, 1, 1.05)) {
      return;
    }
    for (const item of this.#items) {
      if (item.elevation >= 1.8 || item.supportId) {
        continue;
      }
      if (Math.abs(item.x - approachX) < item.width * item.scale / 2 + 0.5 &&
        Math.abs(item.z - z) < item.depth * item.scale / 2 + 0.525) {
        return;
      }
    }
    this.#add("Shelf", x, z, 0.85, 0.36, 0.05, side < 0 ? -90 : 90).height = 1.35;
  }

  /**
   * @param {number} side
   */
  #rearGroup(side) {
    const room = this.#room;
    const banner = this.#add("Banner", this.#center + side * 1.35, room.minZ + 0.38, 0.98, 0.1, 2.7);
    banner.stretch = {
      x: 0.975,
      y: 1.4,
      z: 1,
    };
    banner.height = 1.38;
    const candleX = this.#center + side * 0.92;
    if (this.#fits(candleX, room.minZ + 0.8, 0.54, 0.36)) {
      this.#add("CandleStand", candleX, room.minZ + 0.8, 0.54, 0.36, 0.05, 0, { variant: "court" }).height = 1.615;
    }
    const armorX = this.#center + side * 1.7;
    if (this.#fits(armorX, room.minZ + 0.65, 0.65, 0.55)) {
      this.#add("StandingArmor", armorX, room.minZ + 0.65, 0.65, 0.55);
    }
  }

  /**
   * @param {number} side
   */
  #corner(side) {
    const x = side < 0 ? this.#room.minX + 0.4 : this.#room.maxX - 0.4;
    const z = this.#room.minZ + 0.55;
    if (this.#fits(x, z, 0.5, 0.5)) {
      const planter = this.#add("Planter", x, z, 0.625, 0.625);
      planter.scale = 0.8;
    }
  }

  /**
   * @param {number} side
   */
  #desk(side) {
    const room = this.#room;
    const x = side < 0 ? room.minX + 1.05 : room.maxX - 1.05;
    const z = room.minZ + 3.25;
    if (!this.#fits(x + side * 0.15, z, 1.45, 2.15)) {
      return;
    }
    const table = this.#add("Table", x, z, 0.75, 1.9, 0.05, 0, {
      width: 0.75,
      height: 0.75,
      depth: 1.9,
    });
    table.id = `${room.id}:${room.level}:court-table`;
    table.height = 0.75;
    // All objects are seated on the measured .75 m tabletop, not floating above it.
    const top = 0.8;
    const map = this.#add("WarMapDrawing", x, z, 0.56, 0.65, top + 0.003, 0, {
      width: 0.56,
      depth: 0.65,
    });
    map.height = 0.003;
    map.supportId = table.id;
    this.#detail("DeskGlobe", table, -0.12, -0.68, 0.24, 0.285, top);
    this.#detail("CandleStand", table, 0.18, -0.6, 0.18, 0.2, top, {
      variant: "courtTable",
    }).height = 0.323;
    this.#detail("ParchmentBundle", table, 0, 0.65, 0.35, 0.25, top);
    this.#detail("Book", table, -0.18, 0.43, 0.26, 0.2, top);
    this.#detail("WritingSet", table, 0.19, 0.42, 0.18, 0.2, top).height = 0.29;
    this.#detail("Teacup", table, 0.17, -0.85, 0.422, 0.362, top).scale = 0.45;
    this.#chair(x + side * 0.69, z - 0.48, side);
    this.#chair(x + side * 0.69, z + 0.48, side);
  }

  /**
   * @param {string} object
   * @param {CourtItem} table
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @param {number} elevation
   * @param {Partial<import("../../../../objects/ObjectTypes.js").MapObjectDefinition>} [properties]
   * @returns {CourtItem}
   */
  #detail(object, table, x, z, width, depth, elevation, properties = {}) {
    const item = this.#add(object, table.x + x, table.z + z, width, depth, elevation, 0, properties);
    item.supportId = table.id;

    return item;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} side
   */
  #chair(x, z, side) {
    this.#add("Chair", x, z, 0.429, 0.508, 0.05, side < 0 ? 180 : 0);
  }

  /**
   * @param {number} side
   * @param {number} z
   */
  #bench(side, z) {
    const x = this.#center + side * 1.55;
    if (this.#fits(x, z, 1.4, 0.6)) {
      const bench = this.#add("Bench", x, z, 1.4, 0.6, 0.05, 180);
      bench.mirrorRotationOffset = 0;
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @returns {boolean}
   */
  #fits(x, z, width, depth) {
    const room = this.#room;
    if (x - width / 2 < room.minX + 0.15 || x + width / 2 > room.maxX - 0.15 ||
      z - depth / 2 < room.minZ + 0.15 || z + depth / 2 > room.maxZ - 0.15) {
      return false;
    }
    for (const door of this.#context.openings ?? []) {
      if (door.kind !== "door" || door.roomId !== room.id) {
        continue;
      }
      if (door.axis === "x" ? Math.abs(x - door.coordinate) < width / 2 + 0.75 &&
        Math.abs(z - door.center) < depth / 2 + door.width / 2 + 0.25 :
        Math.abs(z - door.coordinate) < depth / 2 + 0.75 &&
        Math.abs(x - door.center) < width / 2 + door.width / 2 + 0.25) {
        return false;
      }
    }
    for (const stair of this.#context.stairs ?? []) {
      if (room.level >= stair.from && room.level <= stair.to && x + width / 2 > stair.minX &&
        x - width / 2 < stair.maxX && z + depth / 2 > stair.minZ && z - depth / 2 < stair.maxZ) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {string} object
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @param {number} [elevation]
   * @param {number} [rotation]
   * @param {Partial<import("../../../../objects/ObjectTypes.js").MapObjectDefinition>} [properties]
   * @returns {CourtItem}
   */
  #add(object, x, z, width, depth, elevation = 0.05, rotation = 0, properties = {}) {
    const crosswise = Math.abs(Math.sin(rotation * Math.PI / 180)) > 0.5;
    const item = {
      role: "courtProp",
      object,
      x,
      z,
      width: crosswise ? depth : width,
      depth: crosswise ? width : depth,
      scale: 1,
      elevation,
      rotation,
      properties,
      mirrorRotationOffset: object === "Chair" ? 180 : 0,
    };
    this.#items.push(item);

    return item;
  }
}
