/**
 * Furnishes sleeping and utility slots without consuming another room's stream.
 * Prop dimensions are measured grounded GLB envelopes (metres); legacy furniture
 * uses the existing residential model dimensions. Keep a central resting aisle.
 */
export class ServiceRoomFurnishing {
  /**
   * @type {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom}
   */
  #room;
  /**
   * @type {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  #items = [];
  /**
   * @type {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>}
   */
  #access = [];
  /**
   * @type {{x:number,z:number}|undefined}
   */
  #storageBank;
  /**
   * @type {number}
   */
  #state = 2166136261;

  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   */
  constructor(room) {
    this.#room = room;
    for (const character of `${room.furnishingSeed ?? 0}:service:${room.id}:${room.level}`) {
      this.#state = Math.imul(this.#state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const purpose = room.purpose.toLowerCase();
    const royal = /royal|master/.test(purpose);
    const sleeping = royal || /barrack|guest|bed|sleep|servant|quarter|captain|^service$/.test(purpose);
    if (sleeping) {
      const count = /barrack/.test(purpose) ? 2 + Math.floor(this.#random() * 2) : 1;
      for (let index = 0; index < count; index++) {
        const bed = this.#perimeter(royal ? "royalBed" : "servantBed", royal ? 1.2 : 0.8, royal ? 1.8 : 1.6, royal ? 0.75 : 0.675, 0.9);
        if (!bed) { break; }
        // The drawer belongs beside the bed's head, not randomly across the room.
        const angle = bed.rotation * Math.PI / 180;
        const bedWidth = (royal ? 1.2 : 0.8) * bed.scale;
        const bedDepth = (royal ? 1.8 : 1.6) * bed.scale;
        for (const direction of [1, -1]) {
          const sideways = bed.rotation % 180 !== 0;
          const drawer = this.#place("BedsideDrawers", bed.x + direction * Math.cos(angle) * (bedWidth / 2 + 0.46) - Math.sin(angle) * (bedDepth / 2 - 0.3),
            bed.z - direction * Math.sin(angle) * (bedWidth / 2 + 0.46) - Math.cos(angle) * (bedDepth / 2 - 0.3),
            sideways ? 0.5604 : 0.6004, sideways ? 0.6004 : 0.5604, 0.65, 1, bed.rotation);
          if (drawer) {
            if (this.#random() < 0.8) {
              this.#items.push({ role: "serviceProp", object: "TableCandles", x: drawer.x, z: drawer.z,
                width: 0.1407, depth: 0.1916, height: 0.3, scale: 1, rotation: drawer.rotation,
                y: 0.65, supportId: drawer.id, id: `${drawer.id}-candles` });
            }
            break;
          }
        }
      }
      if (royal) { this.#perimeter("wardrobe", 0.65, 0.46, 1.15, 0.9); }
      if (this.#random() < 0.75) { this.#perimeter("readingChair", 0.75, 0.735, 1.665, 0.5); }
    }
    // Armories have supply storage until actual weapon racks are authored.
    this.#storageBank = this.#perimeter("storageShelf", 0.8, 0.3, 1, 0.9);
    if (/kitchen|dining/.test(purpose)) { this.#perimeter("workDesk", 0.9, 0.55, 0.73, 1); }
    const count = sleeping ? 1 + Math.floor(this.#random() * 2) : 3 + Math.floor(this.#random() * 4);
    for (let index = 0; index < count; index++) {
      const choice = Math.floor(this.#random() * 3);
      const props = [["StoragePotteryJar", 0.2286, 0.2359, 0.3], ["WoodenCrate", 0.55, 0.549, 0.4702], ["WoodenBarrel", 0.5528, 0.554, 0.65]];
      const [role, width, depth, height] = props[choice];
      const item = this.#perimeter(role, width, depth, height);
      this.#storageBank ??= item;
    }
  }

  /**
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  get items() { return this.#items; }

  /**
   * @returns {number}
   */
  #random() {
    this.#state = (Math.imul(this.#state, 1664525) + 1013904223) >>> 0;
    return this.#state / 4294967296;
  }

  /**
   * Try seeded positions along the north/south walls, then side walls. Orientations
   * stay cardinal so the measured footprint and resident obstacle agree.
   * @param {string} role
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number} [scale]
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #perimeter(role, width, depth, height, scale = 1) {
    const room = this.#room.contentBounds ?? this.#room;
    const inset = Math.max(0.18, (this.#room.wallThickness ?? 0.25) / 2 + 0.05);
    const candidates = [];
    const halfX = width * scale / 2, halfZ = depth * scale / 2;
    for (const south of [false, true]) {
      for (let x = room.minX + inset + halfX; x <= room.maxX - inset - halfX; x += 0.35) {
        candidates.push({ x, z: south ? room.maxZ - inset - halfZ : room.minZ + inset + halfZ, rotation: south ? 180 : 0 });
      }
    }
    for (const east of [false, true]) {
      const sideways = role.endsWith("Bed");
      const edgeHalfX = sideways ? halfZ : halfX, edgeHalfZ = sideways ? halfX : halfZ;
      for (let z = room.minZ + inset + edgeHalfZ; z <= room.maxZ - inset - edgeHalfZ; z += 0.35) {
        candidates.push({ x: east ? room.maxX - inset - edgeHalfX : room.minX + inset + edgeHalfX, z,
          rotation: sideways ? east ? 270 : 90 : this.#random() < 0.5 ? 0 : 180 });
      }
    }
    for (let index = candidates.length - 1; index > 0; index--) {
      const next = Math.floor(this.#random() * (index + 1));
      [candidates[index], candidates[next]] = [candidates[next], candidates[index]];
    }
    if (this.#storageBank && ["StoragePotteryJar", "WoodenCrate", "WoodenBarrel"].includes(role)) {
      candidates.sort(/**
       * @param {{x:number,z:number}} first
       * @param {{x:number,z:number}} second
       */
      (first, second) => Math.hypot(first.x - this.#storageBank.x, first.z - this.#storageBank.z) -
        Math.hypot(second.x - this.#storageBank.x, second.z - this.#storageBank.z));
    }
    for (const candidate of candidates) {
      const sideways = candidate.rotation % 180 !== 0;
      const item = this.#place(role, candidate.x, candidate.z, sideways ? depth : width, sideways ? width : depth, height, scale, candidate.rotation);
      if (item) { return item; }
    }
  }

  /**
   * @param {string} role
   * @param {number} x
   * @param {number} z
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number} [scale]
   * @param {number} [rotation]
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #place(role, x, z, width, depth, height, scale = 1, rotation = 0) {
    const room = this.#room;
    const bounds = room.contentBounds ?? room;
    const halfX = width * scale / 2, halfZ = depth * scale / 2;
    const minX = x - halfX, maxX = x + halfX, minZ = z - halfZ, maxZ = z + halfZ;
    const inset = Math.max(0.18, (room.wallThickness ?? 0.25) / 2 + 0.05);
    if (minX < bounds.minX + inset - 0.00001 || maxX > bounds.maxX - inset + 0.00001 ||
      minZ < bounds.minZ + inset - 0.00001 || maxZ > bounds.maxZ - inset + 0.00001) { return; }
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const restingClearance = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) < 2.6 ? 0.35 : 0.48;
    if (minX < centerX + restingClearance - 0.00001 && maxX > centerX - restingClearance + 0.00001 &&
      minZ < centerZ + restingClearance - 0.00001 && maxZ > centerZ - restingClearance + 0.00001) { return; }
    for (const access of this.#access) {
      if (maxX > access.minX && minX < access.maxX && maxZ > access.minZ && minZ < access.maxZ) { return; }
    }
    for (const item of this.#items) {
      if (item.supportId) { continue; }
      if (maxX + 0.12 > item.x - item.width * item.scale / 2 && minX - 0.12 < item.x + item.width * item.scale / 2 &&
        maxZ + 0.12 > item.z - item.depth * item.scale / 2 && minZ - 0.12 < item.z + item.depth * item.scale / 2) { return; }
    }
    for (const opening of room.openings ?? []) {
      const door = opening.kind === "door";
      if (!door && height * scale <= opening.bottom - 0.08) { continue; }
      const reach = door ? Math.max(1, opening.width + 0.25) : inset + 0.35;
      // Door-to-centre routes reserve the full entry lane as well as the swing.
      const lane = opening.width / 2 + (door ? 0.35 : 0.08);
      if (opening.axis === "x") {
        if (maxZ > opening.center - lane && minZ < opening.center + lane &&
          (Math.abs(x - opening.coordinate) < halfX + reach || door && minX < Math.max(centerX, opening.coordinate) && maxX > Math.min(centerX, opening.coordinate))) { return; }
      } else if (maxX > opening.center - lane && minX < opening.center + lane &&
        (Math.abs(z - opening.coordinate) < halfZ + reach || door && minZ < Math.max(centerZ, opening.coordinate) && maxZ > Math.min(centerZ, opening.coordinate))) { return; }
    }
    for (const stair of room.stairs ?? []) {
      if (maxX > stair.minX - 0.45 && minX < stair.maxX + 0.45 && maxZ > stair.minZ - 0.45 && minZ < stair.maxZ + 0.45) { return; }
    }
    let access;
    if (["royalBed", "servantBed", "wardrobe", "storageShelf", "workDesk", "readingChair"].includes(role)) {
      const bedMinZ = rotation === 180 ? minZ + 0.15 : z;
      const bedMaxZ = rotation === 180 ? z : maxZ - 0.15;
      const bedMinX = rotation === 90 ? x : minX + 0.15;
      const bedMaxX = rotation === 90 ? maxX - 0.15 : x;
      const approaches = role.endsWith("Bed")
        ? rotation % 180 === 0
          ? [{ minX: maxX, maxX: maxX + 0.6, minZ: bedMinZ, maxZ: bedMaxZ },
            { minX: minX - 0.6, maxX: minX, minZ: bedMinZ, maxZ: bedMaxZ }]
          : [{ minX: bedMinX, maxX: bedMaxX, minZ: maxZ, maxZ: maxZ + 0.6 },
            { minX: bedMinX, maxX: bedMaxX, minZ: minZ - 0.6, maxZ: minZ }]
        : [{ minX, maxX, minZ: rotation === 180 ? minZ - 0.65 : maxZ, maxZ: rotation === 180 ? minZ : maxZ + 0.65 }];
      for (const approach of approaches) {
        if (approach.minX < bounds.minX + inset || approach.maxX > bounds.maxX - inset ||
          approach.minZ < bounds.minZ + inset || approach.maxZ > bounds.maxZ - inset) { continue; }
        let blocked = false;
        for (const item of this.#items) {
          if (item.supportId) { continue; }
          if (approach.maxX > item.x - item.width * item.scale / 2 && approach.minX < item.x + item.width * item.scale / 2 &&
            approach.maxZ > item.z - item.depth * item.scale / 2 && approach.minZ < item.z + item.depth * item.scale / 2) { blocked = true; break; }
        }
        if (!blocked) { access = approach; break; }
      }
      if (!access) { return; }
    }
    const item = { role, x, z, width, depth, height, scale, rotation, id: `${room.id}-service-${this.#items.length}` };
    if (role[0] === role[0].toUpperCase()) { item.object = role; item.role = "serviceProp"; }
    this.#items.push(item);
    if (access) { this.#access.push(access); }
    return item;
  }
}
