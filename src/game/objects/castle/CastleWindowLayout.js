import { CastleResidentialLayout } from "./CastleResidentialLayout.js";

/**
 * @typedef {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}} WindowBounds
 * @typedef {{x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw:number,material:string}} MasonryBox
 * @typedef {{role:string,position:{x:number,y:number,z:number},yaw:number,width:number,height:number,depth:number,cut:WindowBounds,floorY:number}} RecessedWindow
 */

/**
 * Plans apertures against the occupied rooms and the actual built masonry.
 */
export class CastleWindowLayout {
  /**
   * @type {RecessedWindow[]}
   */
  #windows = [];
  /**
   * @type {CastleResidentialLayout}
   */
  #rooms;
  /**
   * @type {Array<WindowBounds & {box:MasonryBox}>}
   */
  #masonry;
  /**
   * @type {import("../../GameContracts.js").CastleBuildPlan}
   */
  #plan;

  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan} plan
   */
  constructor(plan) {
    this.#plan = plan;
    if (plan.layout.empty) {
      return;
    }
    this.#rooms = new CastleResidentialLayout(plan);
    this.#masonry = plan.geometry.boxes.filter(
      /**
       * @param {MasonryBox} box
       */
      (box) => box.material.startsWith("castleStone") || box.material === "castleArchStone",
    ).map(
      /**
       * @param {MasonryBox} box
       */
      (box) => ({ ...this.#localBounds(box), box }),
    );
    const residential = plan.metadata.runtime.residential;
    const upper = this.#rooms.rooms.bedroom;
    const ground = this.#rooms.rooms.work;
    this.#roomWindows(ground, "hall", upper.floorY - 0.25);
    const upperCeiling = residential?.upperRoom?.height
      ? upper.floorY + residential.upperRoom.height
      : upper.floorY + 1.25;
    this.#roomWindows(upper, "room", upperCeiling);
    for (const building of residential?.buildings ?? []) {
      if (building.id === "residence") {
        continue;
      }
      const role = /leisure|lounge|tea/i.test(building.purpose ?? building.id) ? "leisure" : "room";
      this.#roomWindows({ ...building.bounds, floorY: building.floorY }, role, building.floorY + building.height);
    }
    // An open terrace has parapets rather than enclosed room walls. It must not
    // receive decorative holes at an invented storey height.
    this.#towerWindows();
  }

  get windows() { return this.#windows; }

  /**
   * @param {MasonryBox} box
   * @returns {WindowBounds}
   */
  #localBounds(box) {
    const center = this.#rooms.toLocal(box.x, box.z);
    const angle = (box.yaw - this.#rooms.yaw) * Math.PI / 180;
    const halfX = (Math.abs(Math.cos(angle)) * box.sx + Math.abs(Math.sin(angle)) * box.sz) / 2;
    const halfZ = (Math.abs(Math.sin(angle)) * box.sx + Math.abs(Math.cos(angle)) * box.sz) / 2;
    return { minX: center.x - halfX, maxX: center.x + halfX, minZ: center.z - halfZ, maxZ: center.z + halfZ, minY: box.y - box.sy / 2, maxY: box.y + box.sy / 2 };
  }

  /**
   * @param {import("./CastleResidentialLayout.js").ResidentialRoom} room
   * @param {string} role
   * @param {number} ceiling
   */
  #roomWindows(room, role, ceiling) {
    const width = 0.5;
    const sillHeight = ceiling - room.floorY < 1.75 ? 0.9 : 1;
    const height = Math.min(role === "hall" && room.floorY > this.#rooms.origin.y + 0.25 ? 1.25 : 0.75, Math.floor((ceiling - room.floorY - sillHeight - 0.1 + 0.00001) / 0.25) * 0.25);
    if (height < 0.25 || room.floorY < this.#rooms.origin.y) {
      return;
    }
    const sill = room.floorY + sillHeight;
    for (const axis of ["X", "Z"]) {
      const along = axis === "X" ? "Z" : "X";
      for (const sign of [-1, 1]) {
        const face = room[`${sign < 0 ? "min" : "max"}${axis}`];
        const start = room[`min${along}`], end = room[`max${along}`];
        const isRear = axis === "Z" && sign > 0;
        const openingHeight = isRear ? Math.min(height, 0.75) : height;
        const openingRole = isRear && role === "hall" ? "room" : role;
        const runs = [];
        let run = null;
        for (let t = start + 0.125; t < end; t += 0.25) {
          const wall = this.#wallAt(axis, face, t, sill, openingHeight, sign);
          if (!wall) {
            run = null;
            continue;
          }
          const key = `${wall.face.toFixed(3)}:${wall.depth.toFixed(3)}`;
          if (!run || run.key !== key) {
            run = { key, start: t - 0.125, end: t + 0.125, ...wall };
            runs.push(run);
          } else {
            run.end = t + 0.125;
          }
        }
        for (const section of runs) {
          const length = section.end - section.start;
          const count = Math.min(isRear ? 3 : Infinity, Math.floor((length - 0.75) / (isRear ? 2.5 : 1.5)));
          if (count < 1) {
            continue;
          }
          // A common bay grid for both floors. Equal-length walls get precisely
          // the same centers, independent of window height.
          const pitch = length / (count + 1);
          for (let bay = 1; bay <= count; bay += 1) {
            this.#add(axis, section.face, section.start + pitch * bay, sign, sill, width, openingHeight, section.depth, role, room.floorY);
          }
        }
      }
    }
  }

  /**
   * @param {string} axis
   * @param {number} face
   * @param {number} t
   * @param {number} sill
   * @param {number} height
   * @param {number} sign
   * @returns {{face:number,depth:number}|null}
   */
  #wallAt(axis, face, t, sill, height, sign) {
    const along = axis === "X" ? "Z" : "X";
    let result = null;
    for (let y = sill + 0.125; y < sill + height; y += 0.25) {
      const blocks = this.#masonry.filter(
        /**
         * @param {WindowBounds} block
         */
        (block) => t > block[`min${along}`] + 0.00001 && t < block[`max${along}`] - 0.00001 &&
          y > block.minY && y < block.maxY && block[`max${axis}`] > face - 0.8 && block[`min${axis}`] < face + 0.8,
      );
      if (!blocks.length) {
        return null;
      }
      const min = Math.min(...blocks.map(/**
       *
       * @param {WindowBounds} block
       */
      (block) => block[`min${axis}`]));
      const max = Math.max(...blocks.map(/**
       *
       * @param {WindowBounds} block
       */
      (block) => block[`max${axis}`]));
      const exterior = sign < 0 ? min : max;
      const interior = sign < 0 ? max : min;
      if (max - min > 0.8 || (interior - face) * sign < -0.3) {
        return null;
      }
      // Reject partitions, adjoining wings and deep solid tower cores.
      const blocked = this.#masonry.some(
        /**
         * @param {WindowBounds} block
         */
        (block) => t > block[`min${along}`] && t < block[`max${along}`] && y > block.minY && y < block.maxY &&
          (sign < 0 ? block[`max${axis}`] < exterior + 0.001 && block[`max${axis}`] > exterior - 1 : block[`min${axis}`] > exterior - 0.001 && block[`min${axis}`] < exterior + 1),
      );
      if (blocked) {
        return null;
      }
      if (result && (Math.abs(result.face - exterior) > 0.001 || Math.abs(result.depth - (max - min)) > 0.001)) {
        return null;
      }
      result = { face: exterior, depth: max - min };
    }
    return result;
  }

  #towerWindows() {
    const plan = this.#plan;
    const opening = plan.metadata.runtime.audienceOpening;
    const middle = (opening.start + opening.end - 1) / 2;
    const lateralSign = ["WEST", "SOUTH"].includes(plan.layout.primarySide) ? -1 : 1;
    for (const tower of plan.structure.towers) {
      const centerX = lateralSign * (tower.v + (tower.span - 1) / 2 - middle) * 0.25;
      const minZ = tower.u * 0.25;
      const maxZ = (tower.u + (tower.depth ?? tower.span)) * 0.25;
      const floorY = this.#rooms.rooms.work.floorY;
      const sill = floorY + 1;
      if (sill + 1 > this.#rooms.origin.y + tower.height * 0.25 - 0.5) {
        continue;
      }
      // Front openings share the inhabited ground-floor sill line at the rear.
      const frontFloorY = this.#rooms.rooms.work.floorY;
      if (frontFloorY >= this.#rooms.origin.y) {
        const frontOffset = (centerX < 0 ? -1 : 1) * (tower.span * 0.125 - 0.5);
        this.#add("Z", minZ, centerX + frontOffset, -1, frontFloorY + 1, 0.5, 0.75, 0.5, "room", frontFloorY);
      }
      // Defensive flank and rear slits stay below the projecting tower ledge.
      const sign = centerX < 0 ? -1 : 1;
      this.#add("X", centerX + sign * tower.span * 0.125, (minZ + maxZ) / 2, sign, sill, 0.25, 0.75, 0.5, "slit", floorY);
      this.#add("Z", maxZ, centerX, 1, sill, 0.25, 0.75, 0.5, "slit", floorY);
    }
  }

  /**
   * @param {string} axis
   * @param {number} face
   * @param {number} t
   * @param {number} sign
   * @param {number} sill
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   * @param {string} role
   * @param {number} floorY
   */
  #add(axis, face, t, sign, sill, width, height, depth, role, floorY) {
    const x = axis === "X" ? face : t, z = axis === "Z" ? face : t;
    const yaw = this.#rooms.yaw + (axis === "X" ? sign * 90 : sign < 0 ? 180 : 0);
    const position = this.#rooms.toWorld(x, z, sill - this.#rooms.origin.y);
    const angle = yaw * Math.PI / 180;
    const center = { x: position.x - Math.sin(angle) * depth / 2, z: position.z - Math.cos(angle) * depth / 2 };
    const halfX = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * (depth + 0.02)) / 2;
    const halfZ = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * (depth + 0.02)) / 2;
    const cut = { minX: center.x - halfX, maxX: center.x + halfX, minZ: center.z - halfZ, maxZ: center.z + halfZ, minY: sill, maxY: sill + height };
    const stairs = [this.#rooms.stairs, this.#rooms.serviceStair];
    if (stairs.some(
      /**
       * @param {{center:{x:number,y:number,z:number},radius:number,rise:number}} stair
       */
      (stair) => cut.minY < stair.center.y + stair.rise + 1.5 && cut.maxY > stair.center.y &&
        Math.hypot(Math.max(cut.minX - stair.center.x, stair.center.x - cut.maxX, 0), Math.max(cut.minZ - stair.center.z, stair.center.z - cut.maxZ, 0)) < stair.radius + width,
    )) {
      return;
    }
    const doors = [this.#plan.metadata.runtime.residential?.upperDoor, this.#plan.metadata.runtime.residential?.sideDoor, ...(this.#plan.metadata.runtime.residential?.secondaryDoors ?? [])].filter(Boolean);
    if (doors.some(
      /**
       * @param {{x:number,y:number,z:number,width:number,height:number}} door
       */
      (door) => sill < door.y + (door.height ?? 2) && sill + height > door.y && Math.hypot(position.x - door.x, position.z - door.z) < door.width / 2 + width * 1.5,
    )) {
      return;
    }
    if (this.#windows.some(/**
     *
     * @param {RecessedWindow} window
     */
    (window) => CastleWindowLayout.intersects(window.cut, cut))) {
      return;
    }
    const intersectsStone = this.#plan.geometry.boxes.some(
      /**
       * @param {MasonryBox} box
       */
      (box) => box.material.startsWith("castleStone") && CastleWindowLayout.intersects(CastleWindowLayout.bounds(box), cut),
    );
    if (intersectsStone) {
      this.#windows.push({ role, position, yaw, width, height, depth, cut, floorY });
    }
  }

  /**
   * @param {MasonryBox} box
   * @returns {WindowBounds}
   */
  static bounds(box) {
    return { minX: box.x - box.sx / 2, maxX: box.x + box.sx / 2, minY: box.y - box.sy / 2, maxY: box.y + box.sy / 2, minZ: box.z - box.sz / 2, maxZ: box.z + box.sz / 2 };
  }

  /**
   * @param {WindowBounds} a
   * @param {WindowBounds} b
   * @returns {boolean}
   */
  static intersects(a, b) {
    return ["X", "Y", "Z"].every(/**
     *
     * @param {string} axis
     */
    (axis) => a[`max${axis}`] > b[`min${axis}`] + 0.00001 && a[`min${axis}`] < b[`max${axis}`] - 0.00001);
  }

  /**
   * Subtract rectangular apertures without dropping whole intersected blocks.
   * @param {MasonryBox[]} boxes
   * @returns {MasonryBox[]}
   */
  cutBoxes(boxes) {
    let result = boxes;
    for (const window of this.#windows) {
      result = result.flatMap(
        /**
         * @param {MasonryBox} box
         */
        (box) => {
          if (!CastleWindowLayout.intersects(CastleWindowLayout.bounds(box), window.cut)) {
            return [box];
          }
          const remainder = CastleWindowLayout.bounds(box);
          const pieces = [];
          for (const axis of ["X", "Y", "Z"]) {
            for (const side of ["min", "max"]) {
              const key = `${side}${axis}`;
              const boundary = window.cut[key];
              if (side === "min" ? remainder[key] < boundary : remainder[key] > boundary) {
                const piece = { ...remainder, [`${side === "min" ? "max" : "min"}${axis}`]: boundary };
                pieces.push({ ...box, x: (piece.minX + piece.maxX) / 2, y: (piece.minY + piece.maxY) / 2, z: (piece.minZ + piece.maxZ) / 2, sx: piece.maxX - piece.minX, sy: piece.maxY - piece.minY, sz: piece.maxZ - piece.minZ });
                remainder[key] = boundary;
              }
            }
          }
          return pieces;
        },
      );
    }
    return result;
  }
}
