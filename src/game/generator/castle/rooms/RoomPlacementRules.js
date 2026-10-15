import { ROOM_PROP_HEIGHTS, ROOM_PROP_BOTTOMS } from "./RoomPropHeights.js";
import { FireplaceWallBacking } from "./FireplaceWallBacking.js";
import { FireplaceChimneyFootprint } from "../../../objects/fireplace/FireplaceChimneyFootprint.js";

// Model-local rear mounting planes measured from the source GLBs.
const WALL_MOUNTS = {
  Fireplace: -0.45,
  VestibuleCloakRail: -0.058,
  Banner: -0.005,
  HangingFryingPan: -0.0953,
  KitchenUtensilRail: 0,
  RoyalCrest: -0.04,
  WarCouncilShield: -0.05,
};

/**
 * Shared rules for the occupied envelopes published by room generators.
 */
export class RoomPlacementRules {
  /**
   * Width/depth are already aligned to the room axes, including rotation.
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {number} [wallThickness]
   * @returns {boolean}
   */
  static accepts(item, room, occupied, wallThickness = 0.25) {
    const bounds = room.wallBounds ?? room;
    const inset = item.wallAttachment ? -(item.wallInset ?? 0) : wallThickness / 2 + 0.025;
    const halfX = item.width * item.scale / 2;
    const halfZ = item.depth * item.scale / 2;
    if (item.x - halfX < bounds.minX + inset - 1e-6 || item.x + halfX > bounds.maxX - inset + 1e-6 ||
      item.z - halfZ < bounds.minZ + inset - 1e-6 || item.z + halfZ > bounds.maxZ - inset + 1e-6) { return false; }
    const bottom = (item.floorY ?? room.floorY) + (item.y ?? item.elevation ?? 0) + (ROOM_PROP_BOTTOMS[item.object] ?? 0) * item.scale;
    const top = bottom + (item.height ?? ROOM_PROP_HEIGHTS[item.object] ?? room.height) * item.scale;
    /**
     *
     * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} candidate
     */
    const isItemSupport = candidate => candidate.id === item.supportId;
    if (item.supportId && !occupied.some(isItemSupport)) { return false; }
    for (const other of occupied) {
      if (other.object === "Fireplace") {
        const chimney = FireplaceChimneyFootprint.bounds(other, [room]);
        if (bottom < chimney.top - 0.005 && top > chimney.bottom + 0.005 &&
          item.x + halfX > chimney.minX && item.x - halfX < chimney.maxX &&
          item.z + halfZ > chimney.minZ && item.z - halfZ < chimney.maxZ) { return false; }
      }
      const otherBottom = (other.floorY ?? room.floorY) + (other.y ?? other.elevation ?? 0) + (ROOM_PROP_BOTTOMS[other.object] ?? 0) * other.scale;
      const otherTop = otherBottom + (other.height ?? ROOM_PROP_HEIGHTS[other.object] ?? room.height) * other.scale;
      // Contact at a supporting surface is allowed; intersecting volumes are not.
      if (bottom >= otherTop - 0.005 || top <= otherBottom + 0.005) { continue; }
      if (item.supportId === other.id && item.underSupport) { continue; }
      if (Math.abs(item.x - other.x) < halfX + other.width * other.scale / 2 - 1e-6 &&
        Math.abs(item.z - other.z) < halfZ + other.depth * other.scale / 2 - 1e-6) { return false; }
    }

    return true;
  }
  /**
   * Preserve the authored inventory and repair each group at its nearest valid position.
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem[]} items
   * @param {Array<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>} walls
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom[]} rooms
   * @param {Array} openings
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static repair(items, walls, rooms, openings = []) {
    const result = items.map(RoomPlacementRules.#mapItem);
    /**
     * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
     * @returns {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number}}
     */
    const envelope = RoomPlacementRules.#envelope;
    // Older generators publish supported tabletop details without explicit IDs.
    for (const item of result) {
      if (item.supportId || (item.y ?? item.elevation ?? 0) < 0.05 ||
        (item.height ?? ROOM_PROP_HEIGHTS[item.object] ?? 1) * item.scale > 0.5) { continue; }
      const a = envelope(item);
      const support = result.find(/**
       *
       * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} other
       */
        other => {
          if (other === item || other.floorY !== item.floorY) { return false; }
          const b = envelope(other);

          return Math.abs(a.bottom - b.top) < 0.025 && item.x >= b.minX && item.x <= b.maxX && item.z >= b.minZ && item.z <= b.maxZ;
        });
      if (support) { item.supportId = support.id; }
    }
    const placed = [];
    for (const root of result
      .filter(RoomPlacementRules.#filterItem)
      .sort(RoomPlacementRules.#sortFirst)) {
      const group = [root];
      for (let level = 0; level < result.length; level++) {
        for (const child of result) {
          /**
           *
           * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} parent
           */
          const supportsChild = parent => child.supportId === parent.id;
          if (!group.includes(child) && group.some(supportsChild)) { group.push(child); }
        }
      }
      const room = rooms.find(/**
       *
       * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} candidate
       */
        candidate => candidate.floorY === root.floorY && candidate.id === root.roomId) ??
        rooms.find(/**
         *
         * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} candidate
         */
          candidate => candidate.floorY === root.floorY && root.x >= candidate.minX && root.x <= candidate.maxX && root.z >= candidate.minZ && root.z <= candidate.maxZ);
      if (!room) { placed.push(...group); continue; }
      // Mount fixtures by their rear surface, independently of the hanging contents.
      const bookshelf = root.object === "Bookshelf";
      const back = root.wallMountBack ?? (bookshelf ? -0.18 - 0.02501 / root.scale : WALL_MOUNTS[root.object]);
      let mountAxis, mountWall;
      if (back !== undefined) {
        const angle = (root.rotation ?? 0) * Math.PI / 180;
        mountAxis = Math.abs(Math.sin(angle)) > 0.5 ? "x" : "z";
        const sign = Math.round(mountAxis === "x" ? Math.sin(angle) : Math.cos(angle));
        const tangent = mountAxis === "x" ? "z" : "x";
        const half = mountAxis === "x" ? "halfX" : "halfZ";
        const tangentHalf = mountAxis === "x" ? "halfZ" : "halfX";
        const bounds = envelope(root);
        let distance = Infinity;
        for (const wall of walls) {
          if (bounds.top <= wall.y - wall.halfY || bounds.bottom >= wall.y + wall.halfY ||
            Math.abs(root[tangent] - wall[tangent]) > wall[tangentHalf]) { continue; }
          const face = wall[mountAxis] - sign * wall[half];
          const target = face + sign * back * root.scale * (root.stretch?.z ?? 1);
          const delta = target - root[mountAxis];
          if (Math.abs(delta) < distance && delta * sign > -0.2) {
            distance = Math.abs(delta); mountWall = wall;
          }
        }
        if (mountWall && distance < 0.8) {
          const target = mountWall[mountAxis] - sign * mountWall[half] + sign * back * root.scale * (root.stretch?.z ?? 1);
          const shift = target - root[mountAxis];
          for (const item of group) { item[mountAxis] += shift; }
          if (!bookshelf) { root.wallAttachment = true; }
        } else { mountAxis = undefined; }
      }
      const obstacles = walls.map(/**
       *
       * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} wall
       */
        wall => ({
          minX: wall.x - wall.halfX - 0.025,
          maxX: wall.x + wall.halfX + 0.025,
          minZ: wall.z - wall.halfZ - 0.025,
          maxZ: wall.z + wall.halfZ + 0.025,
          bottom: wall.y - wall.halfY,
          top: wall.y + wall.halfY,
          masonry: true,
          mountingWall: wall === mountWall,
        }));
      obstacles.push(...placed.map(/**
       *
       * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
       */
        item => {
          const bounds = envelope(item);
          const neighboringRail = root.object === "VestibuleCloakRail" && item.object === "VestibuleCloakRail" &&
          root.floorY === item.floorY && (root.width > root.depth) === (item.width > item.depth) &&
          Math.abs(root.width > root.depth ? root.z - item.z : root.x - item.x) < 0.35;
          if (neighboringRail) {
          // Keep neighboring garments visually separate along their mounting wall.
            const axis = root.width > root.depth ? "X" : "Z";
            bounds["min" + axis] -= 0.18;
            bounds["max" + axis] += 0.18;
          }
          return {
            ...bounds,
            masonry: false,
            rail: neighboringRail,
          };
        }));
      for (const item of placed) {
        if (item.object === "Fireplace") { obstacles.push(FireplaceChimneyFootprint.bounds(item, rooms)); }
      }
      for (const door of openings) {
        // Glazed openings still have collision backing, but cannot support decor.
        if (!["door", "window"].includes(door.kind) || door.floorY !== root.floorY) { continue; }
        obstacles.push({
          minX: door.axis === "x" ? door.coordinate - 0.15 : door.center - door.width / 2 - 0.08,
          maxX: door.axis === "x" ? door.coordinate + 0.15 : door.center + door.width / 2 + 0.08,
          minZ: door.axis === "z" ? door.coordinate - 0.15 : door.center - door.width / 2 - 0.08,
          maxZ: door.axis === "z" ? door.coordinate + 0.15 : door.center + door.width / 2 + 0.08,
          bottom: door.floorY + (door.kind === "window" ? door.bottom ?? 0 : 0.05),
          top: door.floorY + (door.bottom ?? 0) + (door.height ?? 2.45),
          masonry: false,
        });
      }
      const members = group.map(/**
       *
       * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
       */
        item => ({
          item,
          ...envelope(item),
        }));
      const xs = new Set([0]), zs = new Set([0]);
      for (const member of members) {
        if (!member.item.wallAttachment) {
          xs.add(room.minX - member.minX); xs.add(room.maxX - member.maxX);
          zs.add(room.minZ - member.minZ); zs.add(room.maxZ - member.maxZ);
        }
        for (const obstacle of obstacles) {
          if (member.item.floorCovering && !obstacle.masonry && !obstacle.chimney || member.bottom >= obstacle.top - 0.005 || member.top <= obstacle.bottom + 0.005 || member.item.wallAttachment && obstacle.masonry && obstacle.mountingWall) { continue; }
          xs.add(obstacle.maxX - member.minX + 0.00001); xs.add(obstacle.minX - member.maxX - 0.00001);
          zs.add(obstacle.maxZ - member.minZ + 0.00001); zs.add(obstacle.minZ - member.maxZ - 0.00001);
        }
      }
      if (!bookshelf && mountAxis === "x") { xs.clear(); xs.add(0); }
      if (!bookshelf && mountAxis === "z") { zs.clear(); zs.add(0); }
      const candidates = [];
      for (const x of xs) { for (const z of zs) { candidates.push({
        x,
        z,
        distance: x * x + z * z,
      }); } }
      /**
       * Prefer a clear perimeter position for the complete supported group.
       * @param {{x:number,z:number}} candidate
       * @returns {number}
       */
      const wallDistance = candidate => Math.min(...(root.endWallStorage && root.object === "WoodenStorageChest"
        ? (root.wallAlignment ?? []).slice(0, 2) : root.wallAlignment ?? []).map(/**
       * @param {{axis:string,coordinate:number,side:string}} wall
       */
        wall => {
          const axis = wall.axis === "x" ? "X" : "Z";
          let edge = wall.side === "min" ? Infinity : -Infinity;
          for (const member of members) {
            edge = wall.side === "min" ? Math.min(edge, member["min" + axis]) : Math.max(edge, member["max" + axis]);
          }

          return Math.abs(edge + candidate[wall.axis] - wall.coordinate);
        }));
      if (root.wallAlignment?.length) {
        for (const candidate of candidates) { candidate.wallDistance = Math.floor(wallDistance(candidate) / 0.04); }
      }
      candidates.sort(/**
       *
       * @param {{x:number,z:number,distance:number}} a
       * @param {{x:number,z:number,distance:number}} b
       */
        (a, b) => (root.wallAlignment?.length ? a.wallDistance - b.wallDistance : 0) ||
        a.distance - b.distance || Math.abs(a.x) - Math.abs(b.x) || a.z - b.z);
      /**
     * @param {{x:number,z:number}} candidate
     * @returns {boolean}
     */
      const valid = candidate => members.every(/**
       *
       * @param {{item:import("./AbstractCastleRoomGenerator.js").RoomItem,minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number}} member
       */
        member => {
          const minX = member.minX + candidate.x, maxX = member.maxX + candidate.x;
          const minZ = member.minZ + candidate.z, maxZ = member.maxZ + candidate.z;
          if (member.item.object === "Fireplace" && !FireplaceWallBacking.accepts({
            ...member.item,
            x: member.item.x + candidate.x,
            z: member.item.z + candidate.z,
          }, room, openings, walls, root)) { return false; }
          if (root.stairApproach) {
            const { axis, coordinate, side } = root.stairApproach;
            const edge = side === "max" ? (axis === "x" ? maxX : maxZ) : (axis === "x" ? minX : minZ);
            if (side === "max" ? edge > coordinate : edge < coordinate) { return false; }
          }
          if (!member.item.wallAttachment && (minX < room.minX - 1e-6 || maxX > room.maxX + 1e-6 || minZ < room.minZ - 1e-6 || maxZ > room.maxZ + 1e-6)) { return false; }
          if (!bookshelf && mountAxis && mountWall) {
            const tangentMin = mountAxis === "x" ? minZ : minX;
            const tangentMax = mountAxis === "x" ? maxZ : maxX;
            const center = mountAxis === "x" ? mountWall.z : mountWall.x;
            const half = mountAxis === "x" ? mountWall.halfZ : mountWall.halfX;
            if (tangentMin < center - half - 1e-6 || tangentMax > center + half + 1e-6) { return false; }
            const roomMin = mountAxis === "x" ? room.minZ : room.minX;
            const roomMax = mountAxis === "x" ? room.maxZ : room.maxX;
            if (tangentMin < roomMin - 1e-6 || tangentMax > roomMax + 1e-6) { return false; }
          }
          return obstacles.every(/**
         *
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number,masonry:boolean,mountingWall?:boolean}} obstacle
         */
            obstacle => obstacle.rail ? (root.width > root.depth ? maxX <= obstacle.minX + 1e-6 || minX >= obstacle.maxX - 1e-6 : maxZ <= obstacle.minZ + 1e-6 || minZ >= obstacle.maxZ - 1e-6) : member.item.floorCovering && !obstacle.masonry && !obstacle.chimney || member.item.wallAttachment && obstacle.masonry && obstacle.mountingWall ||
          member.bottom >= obstacle.top - 0.005 || member.top <= obstacle.bottom + 0.005 ||
          maxX <= obstacle.minX + 1e-6 || minX >= obstacle.maxX - 1e-6 || maxZ <= obstacle.minZ + 1e-6 || minZ >= obstacle.maxZ - 1e-6);
        });
      const destination = candidates.find(valid);
      if (destination) {
        for (const item of group) { item.x += destination.x; item.z += destination.z; }
      } else {
        // Never silently erase a furnishing that cannot fit: retain it for diagnostics.
        root.placementIssue = "No clear position in authored room";
      }
      placed.push(...group);
    }

    return result;
  }

  /**
   *
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
   * @param {number} index
   */
  static #mapItem(item, index) {
    return {
      ...item,
      id: item.id ?? "room-placement-" + index,
      floorCovering: item.floorCovering ?? item.object?.endsWith("Rug") ?? false,
    };
  }

  /**
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number}}
   */
  static #envelope(item) {
    const bottom = item.floorY + (item.y ?? item.elevation ?? 0) + (ROOM_PROP_BOTTOMS[item.object] ?? 0) * item.scale;
    const angle = item.underStair ? (item.rotation ?? 0) * Math.PI / 180 : 0;
    const width = item.width * Math.abs(Math.cos(angle)) + item.depth * Math.abs(Math.sin(angle));
    const depth = item.width * Math.abs(Math.sin(angle)) + item.depth * Math.abs(Math.cos(angle));
    const pivotOffset = item.underStair && item.tilt ? item.depth * item.scale / 2 : 0;
    const x = item.x - Math.sin(angle) * pivotOffset;
    const z = item.z - Math.cos(angle) * pivotOffset;

    return {
      minX: x - width * item.scale / 2,
      maxX: x + width * item.scale / 2,
      minZ: z - depth * item.scale / 2,
      maxZ: z + depth * item.scale / 2,
      bottom,
      top: bottom + (item.height ?? ROOM_PROP_HEIGHTS[item.object] ?? 1) * item.scale,
    };
  }

  /**
   *
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
   */
  static #filterItem(item) {
    return !item.supportId;
  }

  /**
   * Reserve perimeter space for complete terminal stacks before loose rows.
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} first
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} second
   */
  static #sortFirst(first, second) {
    return (
      Number(second.object === "Fireplace") - Number(first.object === "Fireplace") ||
      Number(Boolean(second.backPocketStorage)) * 2 - Number(Boolean(first.backPocketStorage)) * 2 ||
      Number(Boolean(second.underStair && second.endWallStorage && second.object === "WoodenStorageChest")) -
      Number(Boolean(first.underStair && first.endWallStorage && first.object === "WoodenStorageChest"))
    );
  }
}
