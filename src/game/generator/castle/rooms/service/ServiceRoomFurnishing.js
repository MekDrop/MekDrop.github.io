/**
 * Furnishes sleeping and utility slots without consuming another room's stream.
 * Prop dimensions are measured grounded GLB envelopes (metres); legacy furniture
 * uses the existing residential model dimensions. Keep a central resting aisle.
 */
export class ServiceRoomFurnishing {
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
   * @type {{x:number,z:number}|undefined}
   */
  #storageBank;
  /**
   * @type {number}
   */
  #state = 2166136261;
  /**
   * @type {boolean}
   */
  #cozy = false;

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   */
  constructor(room) {
    this.#room = room;
    for (const character of `${room.furnishingSeed ?? 0}:service:${room.id}:${room.level}`) {
      this.#state = Math.imul(this.#state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const purpose = room.purpose.toLowerCase();
    const royal = /royal|master/.test(purpose);
    const quarters = !royal && /servant|quarter|^service$/.test(purpose);
    const variant = ["cozy", "mending", "steward"][this.#state % 3];
    this.#cozy = quarters && variant === "cozy";
    const sleeping = royal || /barrack|guest|bed|sleep|servant|quarter|captain|^service$/.test(purpose);
    if (sleeping) {
      const count = /barrack/.test(purpose) ? 2 + Math.floor(this.#random() * 2) : 1;
      for (let index = 0; index < count; index++) {
        const bed = this.#perimeter(royal ? "royalBed" : "servantBed", royal ? 1.2 : 0.9, royal ? 1.8 : 2, royal ? 0.75 : 0.675, 0.9);
        if (!bed) { break; }
        // The drawer belongs beside the bed's head, not randomly across the room.
        const angle = bed.rotation * Math.PI / 180;
        const bedWidth = (royal ? 1.2 : 0.9) * bed.scale;
        const bedDepth = (royal ? 1.8 : 2) * bed.scale;
        for (const direction of [1, -1]) {
          const sideways = bed.rotation % 180 !== 0;
          const drawer = this.#place("BedsideDrawers", bed.x + direction * Math.cos(angle) * (bedWidth / 2 + 0.46) - Math.sin(angle) * (bedDepth / 2 - 0.3),
            bed.z - direction * Math.sin(angle) * (bedWidth / 2 + 0.46) - Math.cos(angle) * (bedDepth / 2 - 0.3),
            sideways ? 0.5604 : 0.6004, sideways ? 0.6004 : 0.5604, 0.65, 1, bed.rotation);
          if (drawer) {
            if (this.#cozy) {
              this.#supported("ServantBedsideLantern", drawer, 0.187, 0.257, 0.45, -0.16);
              this.#supported("StoragePotteryJar", drawer, 0.229, 0.236, 0.3, 0.18);
            } else if (this.#random() < 0.8) {
              this.#items.push({
                role: "serviceProp",
                object: "TableCandles",
                x: drawer.x,
                z: drawer.z,
                width: 0.1407,
                depth: 0.1916,
                height: 0.3,
                scale: 1,
                rotation: drawer.rotation,
                y: 0.65,
                supportId: drawer.id,
                id: `${drawer.id}-candles`,
              });
            }
            break;
          }
        }
        if (this.#cozy) {
          this.#items.push({
            role: "serviceProp",
            object: "Boots",
            id: `${bed.id}-boots`,
            x: bed.x + Math.sin(angle) * bedDepth * 0.36,
            z: bed.z + Math.cos(angle) * bedDepth * 0.36,
            width: bed.rotation % 180 ? 0.32 : 0.4,
            depth: bed.rotation % 180 ? 0.4 : 0.32,
            height: 0.28,
            scale: 0.7,
            rotation: bed.rotation,
            y: 0,
            supportId: bed.id,
            underSupport: true,
          });
        }
      }
      if (royal) { this.#perimeter("wardrobe", 0.65, 0.46, 1.15, 0.9); }
      if (!quarters && this.#random() < 0.75) { this.#perimeter("readingChair", 0.429, 0.508, 0.85, 0.5); }
    }
    if (quarters && variant !== "cozy") { this.#workspace(variant); }
    // Armories have supply storage until actual weapon racks are authored.
    this.#storageBank = this.#perimeter("storageShelf", 0.8, 0.3, 1, this.#cozy ? 1.25 : 0.9);
    if (quarters) {
      if (this.#storageBank) {
        this.#supported("FoldedLinens", this.#storageBank, 0.3, 0.22, 0.16, this.#cozy ? -0.17 : 0);
        if (this.#cozy) { this.#supported("StoragePotteryJar", this.#storageBank, 0.229, 0.236, 0.3, 0.2); }
      }
      this.#perimeter("WoodenStorageChest", 0.7, 0.55, 0.3291, 1);
      if (this.#cozy) {
        const washStand = this.#perimeter("LibrarySideTable", 0.6841, 0.6162, 0.55, 0.9);
        if (washStand) { this.#supported("WashBasin", washStand, 0.5899, 0.5084, 0.2362); }
        else { this.#perimeter("WashBasin", 0.5899, 0.5084, 0.2362, 0.8); }
        this.#perimeter("WaterBucket", 0.304, 0.2865, 0.388, 0.85);
      }
      const rail = this.#perimeter("VestibuleCloakRail", 0.85, 0.16, 0.8, 0.75, 1.05);
      if (rail) {
        rail.width = rail.rotation % 180 ? 0.1771 : 1.1;
        rail.depth = rail.rotation % 180 ? 1.1 : 0.1771;
        rail.height = 1.365;
        const bounds = room.contentBounds ?? room;
        const inset = Math.max(0.18, (room.wallThickness ?? 0.25) / 2 + 0.05);
        rail.x = Math.max(bounds.minX + inset + rail.width * rail.scale / 2, Math.min(rail.x, bounds.maxX - inset - rail.width * rail.scale / 2));
        rail.z = Math.max(bounds.minZ + inset + rail.depth * rail.scale / 2, Math.min(rail.z, bounds.maxZ - inset - rail.depth * rail.scale / 2));
        for (const stair of room.stairs ?? []) {
          const halfX = rail.width * rail.scale / 2, halfZ = rail.depth * rail.scale / 2;
          if (rail.x + halfX <= stair.minX - 0.45 || rail.x - halfX >= stair.maxX + 0.45 ||
            rail.z + halfZ <= stair.minZ - 0.45 || rail.z - halfZ >= stair.maxZ + 0.45) { continue; }
          const candidates = [{
            x: stair.minX - 0.45001 - halfX,
            z: rail.z,
          },
          {
            x: stair.maxX + 0.45001 + halfX,
            z: rail.z,
          },
          {
            x: rail.x,
            z: stair.minZ - 0.45001 - halfZ,
          },
          {
            x: rail.x,
            z: stair.maxZ + 0.45001 + halfZ,
          }];
          candidates.sort(/**
           *
           * @param {{x:number,z:number}} a
           * @param {{x:number,z:number}} b
           */
            (a, b) => Math.hypot(a.x - rail.x, a.z - rail.z) - Math.hypot(b.x - rail.x, b.z - rail.z));
          const fitted = candidates.find(/**
           *
           * @param {{x:number,z:number}} candidate
           */
            candidate => candidate.x - halfX >= bounds.minX + inset && candidate.x + halfX <= bounds.maxX - inset &&
            candidate.z - halfZ >= bounds.minZ + inset && candidate.z + halfZ <= bounds.maxZ - inset);
          if (fitted) { rail.x = fitted.x; rail.z = fitted.z; }
        }

      }
      /**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */
      const isBedsideLantern = ServiceRoomFurnishing.#isBedsideLantern;
      if (!this.#items.some(isBedsideLantern)) {
        this.#perimeter("VestibuleLantern", 0.187, 0.257, 0.45, 1, 1.75);
      }
    }
    if (/kitchen|dining/.test(purpose)) { this.#perimeter("workDesk", 0.9, 0.55, 0.73, 1); }
    const count = quarters ? 0 : sleeping ? 1 + Math.floor(this.#random() * 2) : 3 + Math.floor(this.#random() * 4);
    for (let index = 0; index < count; index++) {
      const choice = Math.floor(this.#random() * 3);
      const props = [["StoragePotteryJar", 0.2286, 0.2359, 0.3], ["Crate", 0.55, 0.549, 0.4702], ["Barrel", 0.5528, 0.554, 0.65]];
      const [role, width, depth, height] = props[choice];
      const item = this.#perimeter(role, width, depth, height);
      this.#storageBank ??= item;
    }
    if (quarters) {
      const bounds = room.contentBounds ?? room;
      const rug = this.#place("Rug", (bounds.minX + bounds.maxX) / 2,
        (bounds.minZ + bounds.maxZ) / 2, 1.2, 0.75, 0.025, this.#cozy ? 1.3 : 1);
      if (rug) { rug.y = 0.003; }
      for (const item of this.#items) { item.furnishingVariant = variant; }
    }
  }

  /**
   * Reserve the desk and its seated approach together, before storage consumes it.
   * @param {string} variant
   */
  #workspace(variant) {
    const group = this.#perimeter("workspaceReserve", 1.05, 1.65, 0.73);
    if (!group) { return; }
    this.#items.pop();
    const angle = group.rotation * Math.PI / 180;
    const sideways = group.rotation % 180 !== 0;
    const desk = {
      role: "serviceProp",
      object: "WritingDesk",
      id: `${group.id}-desk`,
      x: group.x - Math.sin(angle) * 0.55,
      z: group.z - Math.cos(angle) * 0.55,
      width: sideways ? 0.55 : 0.9,
      depth: sideways ? 0.9 : 0.55,
      height: 0.65,
      scale: 1,
      rotation: group.rotation,
    };
    const chair = {
      role: "serviceProp",
      object: "Chair",
      id: `${group.id}-chair`,
      x: group.x + Math.sin(angle) * 0.23,
      z: group.z + Math.cos(angle) * 0.23,
      width: sideways ? 0.43 : 0.51,
      depth: sideways ? 0.51 : 0.43,
      height: 0.85,
      scale: 1,
      rotation: (group.rotation + 270) % 360,
      mirrorRotationOffset: 180,
    };
    this.#items.push(desk, chair);
    this.#access.push({
      minX: group.x - group.width / 2,
      maxX: group.x + group.width / 2,
      minZ: group.z - group.depth / 2,
      maxZ: group.z + group.depth / 2,
    });
    this.#supported(variant === "mending" ? "Basket" : "OpenReadingBook", desk,
      variant === "mending" ? 0.32 : 0.36, variant === "mending" ? 0.28 : 0.227,
      variant === "mending" ? 0.3 : 0.0673, -0.2);
    if (variant === "mending") {
      this.#items.at(-1).items = [
        {
          object: "ClothRoll",
          variant: "cream",
          scale: 1,
          position: {
            x: -0.06704362,
            y: 0.1580755,
            z: -0.03098672,
          },
        },
        {
          object: "ClothRoll",
          variant: "blue",
          scale: 1,
          position: {
            x: 0.06673919,
            y: 0.15806977,
            z: -0.03475429,
          },
        },
        {
          object: "ThreadSpool",
          variant: "tilted",
          scale: 1,
          position: {
            x: -0.06510496,
            y: 0.15822333,
            z: 0.0715482,
          },
        },
        {
          object: "ThreadSpool",
          variant: "small",
          scale: 1,
          position: {
            x: -0.0130072,
            y: 0.15808284,
            z: 0.05435761,
          },
        },
        {
          object: "ThreadSpool",
          variant: "large",
          scale: 1,
          position: {
            x: 0.03576584,
            y: 0.17020223,
            z: 0.07237974,
          },
        },
      ];
    }
    this.#supported(variant === "mending" ? "FoldedLinens" : "DeskParchment", desk,
      variant === "mending" ? 0.3 : 0.3034, variant === "mending" ? 0.22 : 0.35,
      variant === "mending" ? 0.16 : 0.0376, 0.2);
  }

  /**
   * Place a tabletop detail on a measured support instead of on the floor.
   * @param {string} object
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} support
   * @param {number} width
   * @param {number} depth
   * @param {number} height
   * @param {number} [offset]
   */
  #supported(object, support, width, depth, height, offset = 0) {
    const angle = support.rotation * Math.PI / 180;
    const sideways = support.rotation % 180 !== 0;
    this.#items.push({
      role: "serviceProp",
      object,
      id: `${support.id}-${object}`,
      x: support.x + Math.cos(angle) * offset,
      z: support.z - Math.sin(angle) * offset,
      width: sideways ? depth : width,
      depth: sideways ? width : depth,
      height,
      scale: 1,
      rotation: support.rotation,
      y: support.height * support.scale,
      supportId: support.id,
    });
  }

  /**
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
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
   * @param {number} [y]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #perimeter(role, width, depth, height, scale = 1, y = 0) {
    const room = this.#room.contentBounds ?? this.#room;
    const inset = Math.max(0.18, (this.#room.wallThickness ?? 0.25) / 2 + 0.05);
    const candidates = [];
    const halfX = width * scale / 2, halfZ = depth * scale / 2;
    for (const south of [false, true]) {
      for (let x = room.minX + inset + halfX; x <= room.maxX - inset - halfX; x += 0.35) {
        candidates.push({
          x,
          z: south ? room.maxZ - inset - halfZ : room.minZ + inset + halfZ,
          rotation: south ? 180 : 0,
        });
      }
    }
    for (const east of [false, true]) {
      const sideways = role.endsWith("Bed") || ["workspaceReserve", "VestibuleCloakRail", "VestibuleLantern"].includes(role);
      const edgeHalfX = sideways ? halfZ : halfX, edgeHalfZ = sideways ? halfX : halfZ;
      for (let z = room.minZ + inset + edgeHalfZ; z <= room.maxZ - inset - edgeHalfZ; z += 0.35) {
        candidates.push({
          x: east ? room.maxX - inset - edgeHalfX : room.minX + inset + edgeHalfX,
          z,
          rotation: sideways ? east ? 270 : 90 : this.#random() < 0.5 ? 0 : 180,
        });
      }
    }
    for (let index = candidates.length - 1; index > 0; index--) {
      const next = Math.floor(this.#random() * (index + 1));
      [candidates[index], candidates[next]] = [candidates[next], candidates[index]];
    }
    if (this.#cozy && role === "servantBed") {
      for (const south of [false, true]) {
        candidates.push({
          x: (this.#room.wallBounds ?? room).maxX - (this.#room.wallThickness ?? 0.25) / 2 - 0.005 - halfX,
          z: south ? room.maxZ - inset - halfZ : room.minZ + inset + halfZ,
          rotation: south ? 180 : 0,
        });
      }
      candidates.sort(ServiceRoomFurnishing.#sortFirst);
    }
    if (this.#cozy && role === "storageShelf") {
      candidates.sort(ServiceRoomFurnishing.#sortFirst2);
    }
    if (
      this.#storageBank && ["StoragePotteryJar", "Crate", "Barrel"].includes(role)
    ) {
      candidates.sort(this.#sortFirst3.bind(this));
    }
    for (const candidate of candidates) {
      const sideways = candidate.rotation % 180 !== 0;
      const item = this.#place(role, candidate.x, candidate.z, sideways ? depth : width, sideways ? width : depth, height, scale, candidate.rotation, y);
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
   * @param {number} [y]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem|undefined}
   */
  #place(role, x, z, width, depth, height, scale = 1, rotation = 0, y = 0) {
    const room = this.#room;
    const bounds = this.#cozy && role === "servantBed" ? room.wallBounds ?? room.contentBounds ?? room : room.contentBounds ?? room;
    const halfX = width * scale / 2, halfZ = depth * scale / 2;
    const minX = x - halfX, maxX = x + halfX, minZ = z - halfZ, maxZ = z + halfZ;
    const inset = this.#cozy && role === "servantBed"
      ? (room.wallThickness ?? 0.25) / 2 + 0.005
      : Math.max(0.18, (room.wallThickness ?? 0.25) / 2 + 0.05);
    if (minX < bounds.minX + inset - 0.00001 || maxX > bounds.maxX - inset + 0.00001 ||
      minZ < bounds.minZ + inset - 0.00001 || maxZ > bounds.maxZ - inset + 0.00001) { return; }
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const restingClearance = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) < 2.6 ? 0.35 : 0.48;
    const floorObstacle = y < 0.9 && height * scale > 0.05;
    // A full-length bed in a compact room relies on its reserved side approach.
    const compactBed = role.endsWith("Bed") && Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) < 3;
    if (floorObstacle && !compactBed && minX < centerX + restingClearance - 0.00001 && maxX > centerX - restingClearance + 0.00001 &&
      minZ < centerZ + restingClearance - 0.00001 && maxZ > centerZ - restingClearance + 0.00001) { return; }
    for (const access of this.#access) {
      if (floorObstacle && maxX > access.minX && minX < access.maxX && maxZ > access.minZ && minZ < access.maxZ) { return; }
    }
    for (const item of this.#items) {
      if (height * scale <= 0.05 || item.height * item.scale <= 0.05 ||
        y >= (item.y ?? 0) + item.height * item.scale + 0.05 ||
        y + height * scale + 0.05 <= (item.y ?? 0)) { continue; }
      if (maxX + 0.12 > item.x - item.width * item.scale / 2 && minX - 0.12 < item.x + item.width * item.scale / 2 &&
        maxZ + 0.12 > item.z - item.depth * item.scale / 2 && minZ - 0.12 < item.z + item.depth * item.scale / 2) { return; }
    }
    for (const opening of room.openings ?? []) {
      const door = opening.kind === "door";
      if (height * scale <= 0.05 || !door && y + height * scale <= opening.bottom - 0.08) { continue; }
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
          ? [{
            minX: maxX,
            maxX: maxX + 0.6,
            minZ: bedMinZ,
            maxZ: bedMaxZ,
          },
          {
            minX: minX - 0.6,
            maxX: minX,
            minZ: bedMinZ,
            maxZ: bedMaxZ,
          }]
          : [{
            minX: bedMinX,
            maxX: bedMaxX,
            minZ: maxZ,
            maxZ: maxZ + 0.6,
          },
          {
            minX: bedMinX,
            maxX: bedMaxX,
            minZ: minZ - 0.6,
            maxZ: minZ,
          }]
        : [{
          minX,
          maxX,
          minZ: rotation === 180 ? minZ - 0.65 : maxZ,
          maxZ: rotation === 180 ? minZ : maxZ + 0.65,
        }];
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
    const item = {
      role,
      x,
      z,
      width,
      depth,
      height,
      scale,
      rotation,
      y,
      id: `${room.id}-service-${this.#items.length}`,
    };
    if (role[0] === role[0].toUpperCase()) { item.object = role; item.role = "serviceProp"; }
    this.#items.push(item);
    if (access) { this.#access.push(access); }
    return item;
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
   */
  static #isBedsideLantern(item) {
    return item.object === "ServantBedsideLantern";
  }

  /**
   * @param {{x:number,z:number,rotation:number}} first
   * @param {{x:number,z:number,rotation:number}} second
   */
  static #sortFirst(first, second) {
    return (
      Number(first.rotation !== 0) - Number(second.rotation !== 0) || second.x - first.x || first.z - second.z
    );
  }

  /**
   * @param {{x:number,z:number}} first
   * @param {{x:number,z:number}} second
   */
  static #sortFirst2(first, second) {
    return first.x - second.x || first.z - second.z;
  }

  /**
   * @param {{x:number,z:number}} first
   * @param {{x:number,z:number}} second
   */
  #sortFirst3(first, second) {
    return (
      Math.hypot(first.x - this.#storageBank.x, first.z - this.#storageBank.z) -
        Math.hypot(second.x - this.#storageBank.x, second.z - this.#storageBank.z)
    );
  }
}
