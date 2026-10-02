import { createCastleInteriorFloorAreas } from "./CastleInteriorFloorAreas.js";
/**
 * @typedef {{x: number, y: number, z: number}} ResidentialPoint
 * @typedef {{minX: number, maxX: number, minZ: number, maxZ: number, floorY: number, purpose: string}} ResidentialRoom
 * @typedef {{role: string, position: ResidentialPoint, scale: ResidentialPoint, yaw: number}} ResidentialPlacement
 */

/**
 * Pure placement and navigation contract for the castle's occupied floors.
 */
export class CastleResidentialLayout {
  /**
   * @type {ResidentialPoint}
   */
  #origin;
  /**
   * @type {number}
   */
  #yaw;
  /**
   * @type {Record<string, ResidentialRoom>}
   */
  #rooms;
  /**
   * @type {ResidentialPlacement[]}
   */
  #placements = [];
  /**
   * @type {ResidentialPlacement[]}
   */
  #exteriorWindows = [];
  /**
   * @type {ResidentialPlacement[]}
   */
  #exteriorButtresses = [];
  /**
   * @type {Array<{x:number,z:number,baseY:number,topY:number,width:number,depth:number}>}
   */
  #buttressFootings = [];

  /**
   * @type {Array<{role: string, minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number}>
   */
  #reservations = [];
  /**
   * @type {{center: ResidentialPoint, radius: number, innerRadius: number, rise: number, steps: number, turns: number, treads: ResidentialPoint[], yaw: number}}
   */
  #stairs;
  /**
   * @type {Array<{id: string, minX: number, maxX: number, minZ: number, maxZ: number, floorY: number}>}
   */
  #walkableAreas = [];
  /**
   * @type {{floorY: number, access: ResidentialPoint, partition: ResidentialPoint, locked: boolean}}
   */
  #basement;
  /**
   * @type {ResidentialPoint & {yaw: number, width?: number, height?: number}}
   */
  #serviceDoor;
  /**
   * @type {import("./TerraceActor.js").TerraceActor|null}
   */
  #servant = null;

  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   */
  constructor(buildPlan) {
    const { position, doors } = buildPlan.input;
    const door = doors[0];
    const runtime = buildPlan.metadata.runtime;
    const layout = buildPlan.layout;
    const blockSize = 0.25;
    const side = door.side;
    const along = door.offset + door.width / 2;
    const origins = {
      NORTH: { x: position.x + along, z: position.z },
      SOUTH: { x: position.x + along, z: position.z + position.depth },
      WEST: { x: position.x, z: position.z + along },
      EAST: { x: position.x + position.width, z: position.z + along },
    };
    this.#origin = runtime.residential?.origin ?? { ...origins[side], y: layout.baseY ?? position.elevation ?? 0 };
    this.#yaw = { NORTH: 0, SOUTH: 180, WEST: 90, EAST: -90 }[side];
    const depth = layout.castleDepth * blockSize;
    const gateDepth = runtime.residential?.gatehouseDepth ?? Math.min(layout.style.towerSpanBlocks, layout.castleDepth) * blockSize;
    const upperY = this.#origin.y + (layout.style.wallHeightBlocks + 1) * blockSize;
    const opening = runtime.audienceOpening;
    const bedroomWidth = runtime.residential?.upperRoom?.width ?? (opening.end - opening.start + 8) * blockSize;
    const bedroomDepth = runtime.residential?.upperRoom?.depth ?? gateDepth - blockSize * 2;
    const bedroomCenter = runtime.residential?.upperRoom ? this.toLocal(runtime.residential.upperRoom.x, runtime.residential.upperRoom.z) : { x: 0, z: gateDepth / 2 };
    const balconyStart = runtime.residential?.balcony?.startDepth ?? gateDepth;
    const balconyEnd = runtime.residential?.balcony?.endDepth ?? depth - blockSize;
    const workDefinition = runtime.residential?.workRoom;
    const workWidth = workDefinition?.width ?? runtime.interiorWidth;
    const workCenter = workDefinition ? this.toLocal(workDefinition.x, workDefinition.z) : { x: 0, z: (0.5 + depth - blockSize) / 2 };
    const rearStart = gateDepth + blockSize;
    const rearEnd = Math.max(rearStart + blockSize, depth - blockSize);
    const basementY = runtime.residential?.basement?.floorY ?? this.#origin.y - 2.5;
    const basementDefinition = runtime.residential?.basement;
    const basementCenter = basementDefinition ? this.toLocal(basementDefinition.x, basementDefinition.z) : { x: 0, z: (rearStart + rearEnd) / 2 };
    const basementWidth = basementDefinition?.width ?? workWidth;
    const basementDepth = basementDefinition?.depth ?? rearEnd - rearStart;
    const basementFront = basementCenter.z - basementDepth / 2;
    const basementRear = basementCenter.z + basementDepth / 2;
    this.#rooms = {
      work: { minX: workCenter.x - workWidth / 2, maxX: workCenter.x + workWidth / 2, minZ: workDefinition ? workCenter.z - workDefinition.depth / 2 : 0.5, maxZ: workDefinition ? workCenter.z + workDefinition.depth / 2 : rearEnd, floorY: this.#origin.y, purpose: "work" },
      bedroom: { minX: bedroomCenter.x - bedroomWidth / 2, maxX: bedroomCenter.x + bedroomWidth / 2, minZ: bedroomCenter.z - bedroomDepth / 2, maxZ: bedroomCenter.z + bedroomDepth / 2, floorY: upperY, purpose: "sleep" },
      balcony: { minX: -workWidth / 2, maxX: workWidth / 2, minZ: balconyStart, maxZ: balconyEnd, floorY: upperY, purpose: "empty balcony" },
      servantBedroom: { minX: basementCenter.x - basementWidth / 2, maxX: basementCenter.x - 0.05, minZ: basementFront, maxZ: basementRear, floorY: basementY, purpose: "servant sleep" },
      storage: { minX: basementCenter.x + 0.05, maxX: basementCenter.x + basementWidth / 2, minZ: basementFront, maxZ: basementRear, floorY: basementY, purpose: "storage" },
    };
    if (runtime.residential?.rooms) {
      this.#rooms = { ...this.#rooms, ...runtime.residential.rooms };
    }
    this.#walkableAreas = (runtime.residential?.walkableAreas ?? []).map(/**
     * @param {{id: string, bounds?: object, floorY: number}} area
     */ (area) => ({ ...area, ...(area.bounds ?? {}), floorY: area.floorY }));
    // Bridge the full front-wall depth between the last exterior tread and
    // the courtyard/work floor. The door opening must have actual support.
    this.#walkableAreas.push({ id: "mainDoorThreshold", minX: -door.width / 2, maxX: door.width / 2, minZ: -0.25, maxZ: Math.max(0.75, runtime.residential?.facadeDepth ?? 0.5) + 0.25, floorY: this.#origin.y });
    for (const [index, door] of (runtime.residential?.secondaryDoors ?? []).entries()) {
      const local = this.toLocal(door.x, door.z);
      const angle = (door.yaw - this.#yaw) * Math.PI / 180;
      const crosswise = Math.abs(Math.sin(angle)) > 0.5;
      const halfWidth = door.width / 2 + 0.1;
      this.#walkableAreas.push({ id: `doorThreshold${index}`, minX: local.x - (crosswise ? 0.4 : halfWidth), maxX: local.x + (crosswise ? 0.4 : halfWidth), minZ: local.z - (crosswise ? halfWidth : 0.4), maxZ: local.z + (crosswise ? halfWidth : 0.4), floorY: door.y });
    }
    const suppliedStair = runtime.residential?.stair;
    const lateralSign = ["WEST", "SOUTH"].includes(side) ? -1 : 1;
    const stairCenter = suppliedStair ?? this.toWorld(lateralSign * (door.width / 2 + 0.25), gateDepth - 0.75, 0);
    const radius = suppliedStair?.radius ?? Math.min(0.6, bedroomDepth / 2);
    const rise = upperY - this.#origin.y;
    const steps = 24;
    const turns = 1.5;
    const stairLocal = this.toLocal(stairCenter.x, stairCenter.z);
    const stairYaw = this.#yaw + (radius > 1 && stairLocal.x < (this.#rooms.bedroom.minX + this.#rooms.bedroom.maxX) / 2 ? 180 : 0);
    const treads = [];
    for (let step = 1; step <= steps; step += 1) {
      const angle = Math.PI / 2 - stairYaw * Math.PI / 180 - ((step - 0.5) / steps) * turns * Math.PI * 2;
      treads.push({ x: stairCenter.x + Math.cos(angle) * radius * 0.335 / 0.65, y: this.#origin.y + rise * step / steps, z: stairCenter.z + Math.sin(angle) * radius * 0.335 / 0.65 });
    }
    this.#stairs = { center: { x: stairCenter.x, y: this.#origin.y, z: stairCenter.z }, radius, innerRadius: radius * 0.08 / 0.65, rise, steps, turns, treads, yaw: stairYaw };
    const landingCenter = stairLocal;
    const landingSign = stairYaw === this.#yaw ? -1 : 1;
    // Exit the final tread tangentially toward the occupied room, rather than
    // crossing the shaft or the outer handrail.
    this.#walkableAreas.push({ id: "mainStairLanding",
      minX: landingCenter.x + (landingSign < 0 ? -radius - 0.3 : -0.05),
      maxX: landingCenter.x + (landingSign < 0 ? 0.05 : radius + 0.3),
      minZ: landingCenter.z + landingSign * radius * (landingSign < 0 ? 0.59 : 0.08) / 0.65,
      maxZ: landingCenter.z + landingSign * radius * (landingSign < 0 ? 0.08 : 0.59) / 0.65,
      floorY: upperY });
    const basementElevation = basementY - this.#origin.y;
    const serviceLateral = Math.min(workWidth / 2 - 0.65, workWidth / 2 - layout.style.towerSpanBlocks * blockSize - 0.6);
    this.#basement = { floorY: basementY, access: runtime.residential?.serviceStair ? { ...runtime.residential.serviceStair, y: this.#origin.y } : this.toWorld(serviceLateral, runtime.residential?.balcony ? Math.min(basementRear - 0.65, Math.max(basementFront + 0.65, 2)) : rearStart + 0.65, 0), partition: this.toWorld(basementCenter.x, basementCenter.z, basementElevation), locked: true };
    this.#serviceDoor = runtime.residential?.serviceDoor ?? { ...this.#basement.access, yaw: this.#yaw };
    if (runtime.residential?.serviceDoor) {
      const entry = this.toLocal(this.#serviceDoor.x, this.#serviceDoor.z);
      const shaft = this.toLocal(this.#basement.access.x, this.#basement.access.z);
      const inwardSign = shaft.x > entry.x ? 1 : -1;
      this.#walkableAreas.push({ id: "serviceDoorThreshold",
        minX: Math.min(entry.x - inwardSign * 0.4, shaft.x),
        maxX: Math.max(entry.x - inwardSign * 0.4, shaft.x),
        minZ: entry.z - 0.5, maxZ: Math.max(entry.z + 0.5, shaft.z - 0.7), floorY: this.#origin.y });
    }
    if (runtime.residential?.reservations?.serviceStair) {
      const bay = runtime.residential.reservations.serviceStair;
      const entry = this.toLocal(this.#serviceDoor.x, this.#serviceDoor.z);
      const work = this.#rooms.work;
      const hallEdge = entry.x < work.minX ? work.minX : entry.x > work.maxX ? work.maxX : entry.x;
      this.#walkableAreas.push({ id: "serviceGroundBay",
        minX: Math.min(entry.x, bay.minX, hallEdge), maxX: Math.max(entry.x, bay.maxX, hallEdge),
        minZ: Math.min(entry.z - 0.5, bay.minZ), maxZ: Math.max(entry.z + 0.5, bay.maxZ), floorY: this.#origin.y });
    }
    if (runtime.residential?.outerBounds) {
      this.#walkableAreas.push({ id: "castleGroundFloor", ...runtime.residential.outerBounds, floorY: this.#origin.y });
    } else {
      this.#walkableAreas.push(...createCastleInteriorFloorAreas(buildPlan, this));
    }
    const serviceCenter = this.toLocal(this.#basement.access.x, this.#basement.access.z);
    const serviceExitSign = serviceCenter.x < (this.#rooms.work.minX + this.#rooms.work.maxX) / 2 ? 1 : -1;
    const serviceRadius = this.serviceStair.radius;
    this.#walkableAreas.push({ id: "serviceStairLanding",
      minX: serviceCenter.x + (serviceExitSign < 0 ? -serviceRadius - 0.3 : -0.05),
      maxX: serviceCenter.x + (serviceExitSign < 0 ? 0.05 : serviceRadius + 0.3),
      minZ: serviceCenter.z + serviceExitSign * serviceRadius * (serviceExitSign < 0 ? 0.59 : 0.08) / 0.65,
      maxZ: serviceCenter.z + serviceExitSign * serviceRadius * (serviceExitSign < 0 ? 0.08 : 0.59) / 0.65,
      floorY: this.#origin.y });
    const deskSlot = runtime.residential?.reservations?.workDesk;
    this.#place("workDesk", deskSlot ? (deskSlot.minX + deskSlot.maxX) / 2 : (stairLocal.x > 0 ? this.#rooms.work.minX + 0.6 : this.#rooms.work.maxX - 0.6), deskSlot ? (deskSlot.minZ + deskSlot.maxZ) / 2 : this.#rooms.work.minZ + 1.05, 0, Math.min(1, workWidth / 4));
    const activeBedroom = this.#rooms.bedroom;
    const activeWidth = activeBedroom.maxX - activeBedroom.minX;
    const activeDepth = activeBedroom.maxZ - activeBedroom.minZ;
    const bedScale = Math.min(0.85, (activeDepth - 0.35) / 1.8, activeWidth / (radius > 1 ? 4.6 : 4));
    const stairLateral = this.toLocal(stairCenter.x, stairCenter.z).x;
    const furnitureSide = stairLateral < (activeBedroom.minX + activeBedroom.maxX) / 2 ? 1 : -1;
    const bedLateral = (activeBedroom.minX + activeBedroom.maxX) / 2 + furnitureSide * (activeWidth / 2 - 0.08 - bedScale * 0.6);
    const nextLateral = bedLateral - furnitureSide * (bedScale * 0.6 + 0.32);
    const sideDoor = runtime.residential?.sideDoor;
    if (radius > 1) {
      // Keep bedroom furniture on the wall opposite the full-size stair shaft.
      const edge = furnitureSide > 0 ? activeBedroom.maxX : activeBedroom.minX;
      this.#place("royalBed", edge - furnitureSide * (bedScale * 0.6 + 0.12), activeBedroom.maxZ - 0.12 - bedScale * 0.9, rise, bedScale);
      this.#place("wardrobe", edge - furnitureSide * 0.35, activeBedroom.minZ + 1.35, rise, 0.65);
      this.#place("readingChair", (activeBedroom.minX + activeBedroom.maxX) / 2 - furnitureSide * 0.2, activeBedroom.minZ + 0.2, rise, 0.5);
    } else if (sideDoor) {
      const localDoor = this.toLocal(sideDoor.x, sideDoor.z);
      const doorSide = localDoor.x > (activeBedroom.minX + activeBedroom.maxX) / 2 ? 1 : -1;
      const center = (activeBedroom.minX + activeBedroom.maxX) / 2;
      this.#place("royalBed", center - doorSide * Math.min(1.3, activeWidth / 2 - bedScale * 0.6 - 0.15), activeBedroom.maxZ - 0.12 - bedScale * 0.9, rise, bedScale);
      this.#place("wardrobe", center - doorSide * (activeWidth / 2 - 0.35), activeBedroom.minZ + 0.3, rise, 0.65);
      this.#place("readingChair", center - doorSide * 0.85, activeBedroom.minZ + 0.35, rise, 0.5);
    } else {
      this.#place("royalBed", bedLateral, (activeBedroom.minZ + activeBedroom.maxZ) / 2, rise, bedScale);
      this.#place("wardrobe", nextLateral, this.#rooms.bedroom.minZ + 0.22, rise, 0.65);
      this.#place("readingChair", nextLateral, this.#rooms.bedroom.maxZ - 0.3, rise, 0.5);
    }
    this.#place("servantBed", basementCenter.x - basementWidth * 0.27, basementCenter.z, basementElevation, Math.min(0.8, basementWidth / 4, (basementDepth - 0.15) / 1.6));
    this.#place("storageShelf", basementCenter.x + basementWidth * 0.3, basementRear - 0.35, basementElevation, Math.min(0.75, basementWidth / 4));
    const work = this.#rooms.work;
    const mainLocal = this.toLocal(this.#stairs.center.x, this.#stairs.center.z);
    const serviceLocal = this.toLocal(this.#basement.access.x, this.#basement.access.z);
    const desk = this.#placements.find(/**
     * @param {ResidentialPlacement} placement
     */ (placement) => placement.role === "workDesk");
    const deskLocal = this.toLocal(desk.position.x, desk.position.z);
    this.#reservations = [
      { role: "centralAisle", minX: -0.6, maxX: 0.6, minZ: work.minZ, maxZ: work.maxZ - 1.9, minY: 0, maxY: rise },
      { role: "throne", minX: -1.4, maxX: 1.4, minZ: work.maxZ - 1.9, maxZ: work.maxZ - 0.1, minY: 0, maxY: 2.5 },
      { role: "mainStair", minX: mainLocal.x - radius - 0.2, maxX: mainLocal.x + radius + 0.2, minZ: mainLocal.z - radius - 0.2, maxZ: mainLocal.z + radius + 0.2, minY: 0, maxY: rise + 1 },
      { role: "serviceStair", minX: serviceLocal.x - 0.6, maxX: serviceLocal.x + 0.6, minZ: serviceLocal.z - 0.6, maxZ: serviceLocal.z + 0.6, minY: basementElevation, maxY: 1.5 },
      { role: "workDesk", minX: deskLocal.x - 0.45 * desk.scale.x - 0.2, maxX: deskLocal.x + 0.45 * desk.scale.x + 0.2, minZ: deskLocal.z - 0.275 * desk.scale.z - 0.2, maxZ: deskLocal.z + 0.275 * desk.scale.z + 0.2, minY: 0, maxY: 0.73 * desk.scale.y },
    ];    if (runtime.residential?.reservations) {
      this.#reservations = Object.entries(runtime.residential.reservations).map(/**
       * @param {[string, {minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number}]} entry
       */ ([role, bounds]) => ({ role, ...bounds }));
    }
    const deskSide = deskLocal.x > (work.minX + work.maxX) / 2 ? 1 : -1;
    this.#reservations.push({ role: "bookcase", minX: deskSide > 0 ? work.maxX - 0.75 : work.minX + 0.05, maxX: deskSide > 0 ? work.maxX - 0.05 : work.minX + 0.75, minZ: work.minZ + (work.maxZ - work.minZ) * 0.45 - 0.5, maxZ: work.minZ + (work.maxZ - work.minZ) * 0.45 + 0.5, minY: 0, maxY: 1.8 });
    const room = this.#rooms.bedroom;
    const upperFront = (runtime.residential?.balcony?.endDepth ?? room.minZ - 0.125) - 0.14;
    const centerX = (work.minX + work.maxX) / 2;
    for (const flank of [-1, 1]) {
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(centerX + flank * Math.min(1.25, (work.maxX - work.minX) / 4), upperFront, rise + 0.9), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + 180 });
      const lateral = bedroomCenter.x + flank * (bedroomWidth / 2 + 0.26);
      let forward = room.minZ + (room.maxZ - room.minZ) * 0.72;
      if (sideDoor) {
        const door = this.toLocal(sideDoor.x, sideDoor.z);
        const doorFlank = door.x < centerX ? -1 : 1;
        if (doorFlank === flank && Math.abs(door.z - forward) < (sideDoor.width ?? 0.9) / 2 + 0.42) {
          forward = room.maxZ - 0.4;
        }
      }
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(lateral, forward, rise + 0.9), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + flank * 90 });
    }
    const portalHalfWidth = door.width / 2 + 0.25;
    for (const flank of [-1, 1]) {
      const frontTower = (buildPlan.structure?.towers ?? []).find(/**
                                                                   * @param {{v: number, span: number, front: boolean}} tower
                                                                   */ (tower) => {
        const lateral = lateralSign * (tower.v + (tower.span - 1) / 2 - (opening.start + opening.end - 1) / 2) * blockSize;
        return tower.front && Math.sign(lateral) === flank;
      });
      const towerCenter = frontTower ? lateralSign * (frontTower.v + (frontTower.span - 1) / 2 - (opening.start + opening.end - 1) / 2) * blockSize : 0;
      const edge = frontTower ? Math.abs(towerCenter) - frontTower.span * blockSize / 2 : (work.maxX - work.minX) / 2;
      if (edge - portalHalfWidth < 0.6) continue;
      const lateral = flank * (edge + portalHalfWidth) / 2;
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(lateral, (runtime.residential?.facadeDepth ?? 0.75) - 0.14, 1.1), scale: { x: 0.75, y: 1, z: 1 }, yaw: this.#yaw + 180 });
    }
    const rearFace = depth - 0.085;
    const upperCenter = (room.minX + room.maxX) / 2;
    for (const flank of [-1, 1]) {
      const lateral = upperCenter + flank * Math.min(1.1, (room.maxX - room.minX) / 4);
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(lateral, rearFace, rise + 0.9), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw });
    }
    for (const fraction of [0.25, 0.5, 0.75]) {
      const lateral = work.minX + (work.maxX - work.minX) * fraction;
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(lateral, rearFace, 1.1), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw });
    }
    const openingMiddle = (opening.start + opening.end - 1) / 2;
    const faceStart = lateralSign * -openingMiddle * blockSize;
    const facadeSpan = layout.facadeSpan ?? (["WEST", "EAST"].includes(side) ? position.depth : position.width) / blockSize;
    const faceEnd = lateralSign * (facadeSpan - 1 - openingMiddle) * blockSize;
    const sideFaces = [Math.min(faceStart, faceEnd) - blockSize / 2, Math.max(faceStart, faceEnd) + blockSize / 2];
    for (const [index, lateral] of sideFaces.entries()) {
      const flank = index === 0 ? -1 : 1;
      this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(lateral + flank * 0.015, (work.minZ + work.maxZ) / 2, 1.1), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + flank * 90 });
    }
    for (const tower of buildPlan.structure?.towers ?? []) {

      const lateral = lateralSign * (tower.v + (tower.span - 1) / 2 - (opening.start + opening.end - 1) / 2) * blockSize;
      const scale = Math.min(0.85, tower.span * blockSize * 0.5 / 0.6);
      this.#exteriorWindows.push({ role: "towerWindow", position: this.toWorld(lateral, tower.front ? tower.u * blockSize - 0.15 : (tower.u + (tower.depth ?? tower.span) - 0.5) * blockSize + 0.04, Math.max(0.8, tower.height * blockSize - 1.2)), scale: { x: scale, y: scale, z: 1 }, yaw: this.#yaw + (tower.front ? 180 : 0) });
    }
    if (runtime.residential?.exteriorWindows) {
      const buildings = runtime.residential.buildings;
      if (!buildings) {
        this.#exteriorWindows = runtime.residential.exteriorWindows;
      } else {
        const courtyard = this.#walkableAreas.some(/**
         * @param {{id: string}} area
         */ (area) => area.id === "courtyard");
        const lowerWindows = this.#exteriorWindows.filter(/**
         * @param {ResidentialPlacement} placement
         */ (placement) => placement.role === "towerWindow" || (placement.position.y < room.floorY && (!courtyard || placement.yaw - this.#yaw !== 180)));
        this.#exteriorWindows = [...runtime.residential.exteriorWindows, ...lowerWindows];
        if (courtyard) {
          for (const flank of [-1, 1]) {
            this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(centerX + flank * (work.maxX - work.minX) * 0.32, work.minZ - 0.29, 1.1), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + 180 });
          }
        }
        for (const building of buildings) {
          const bounds = building.bounds;
          for (const fraction of [0.27, 0.73]) {
            this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(bounds.minX + (bounds.maxX - bounds.minX) * fraction, bounds.maxZ + 0.29, building.floorY - this.#origin.y + 0.9), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw });
          }
          for (const flank of [-1, 1]) {
            const x = flank < 0 ? bounds.minX - 0.29 : bounds.maxX + 0.29;
            const z = bounds.minZ + (bounds.maxZ - bounds.minZ) * 0.72;
            this.#exteriorWindows.push({ role: "squareWindow", position: this.toWorld(x, z, building.floorY - this.#origin.y + 0.9), scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + flank * 90 });
          }
        }
      }
    }
    // Window glass, its inward aperture, and the adjoining wall lantern must
    // leave the complete occupied spiral shaft clear at every storey.
    this.#exteriorWindows = this.#exteriorWindows.filter(/**
     * @param {{role: string, position: {x: number, y: number, z: number}, scale: {x: number, y: number, z: number}, yaw: number}} placement Window and its attached lantern envelope.
     */ (placement) => {
      const lower = placement.position.y;
      const upper = lower + 0.8 * placement.scale.y + 0.25;
      if (upper < this.#stairs.center.y || lower > this.#stairs.center.y + rise + 1.65) { return true; }
      const angle = placement.yaw * Math.PI / 180;
      const tangent = { x: Math.cos(angle), z: -Math.sin(angle) };
      const normal = { x: Math.sin(angle), z: Math.cos(angle) };
      const dx = this.#stairs.center.x - placement.position.x;
      const dz = this.#stairs.center.z - placement.position.z;
      const lateral = Math.abs(dx * tangent.x + dz * tangent.z);
      const inward = Math.abs(dx * normal.x + dz * normal.z);
      const halfWidth = placement.role === "squareWindow" ? 0.75 : 0.3 * placement.scale.x;
      const distance = Math.hypot(Math.max(0, lateral - halfWidth), Math.max(0, inward - 0.6));
      return distance > this.#stairs.radius + 0.22;
    });
    const primaryBounds = runtime.residential?.buildings?.find(/**
     * @param {{id: string, bounds: {minX:number,maxX:number,minZ:number,maxZ:number}}} building
     */ (building) => building.id === "residence")?.bounds;
    if (primaryBounds) {
      const landing = this.#walkableAreas.find(/**
       * @param {{id: string}} area
       */ (area) => area.id === "mainStairLanding");
      // The landing's tread overlap may reach the wall; its visible timber
      // and collision must stop at the occupied keep's interior face.
      landing.minX = Math.max(landing.minX, primaryBounds.minX);
      landing.maxX = Math.min(landing.maxX, primaryBounds.maxX);
      landing.minZ = Math.max(landing.minZ, primaryBounds.minZ);
      landing.maxZ = Math.min(landing.maxZ, primaryBounds.maxZ);
    }
    this.#planButtresses(buildPlan);
  }

  /**
   * Shared Blender buttress placements, also used to derive terrain footings.
   * @param {import("../../GameContracts.js").CastleBuildPlan} plan
   */
  #planButtresses(plan) {
    const blockSize = 0.25;
    const lateralSign = ["WEST", "SOUTH"].includes(plan.input.doors[0].side) ? -1 : 1;
    const opening = plan.metadata.runtime.audienceOpening;
    const middle = opening ? (opening.start + opening.end - 1) / 2 : 0;
    for (const tower of plan.structure?.towers ?? []) {
      const centerX = lateralSign * (tower.v + (tower.span - 1) / 2 - middle) * blockSize;
      for (const flank of [-1, 1]) {
        const x = centerX + flank * (tower.span * blockSize / 2 + 0.1);
        const z = tower.front ? tower.u * blockSize - 0.225 : (tower.u + (tower.depth ?? tower.span)) * blockSize - 0.025;
        this.#exteriorButtresses.push({ role: "cornerButtress", position: this.toWorld(x, z),
          scale: { x: 1, y: 1, z: 1 }, yaw: this.#yaw + (tower.front ? (flank < 0 ? -90 : 180) : (flank < 0 ? 0 : 90)) });
        if (tower.front && Math.sign(centerX) === flank) {
          const rearZ = (tower.u + (tower.depth ?? tower.span)) * blockSize - 0.025;
          this.#exteriorButtresses.push({ role: "outerButtress", position: this.toWorld(x, rearZ),
            scale: { x: 1, y: 0.85 + (tower.v % 3) * 0.075, z: 1 }, yaw: this.#yaw + (flank < 0 ? 0 : 90) });
        }
      }
    }
    this.#buttressFootings = plan.metadata.runtime.residential?.buttressFootings ?? [];
  }

  get origin() { return this.#origin; }
  get yaw() { return this.#yaw; }
  get rooms() { return this.#rooms; }
  get walkableAreas() { return this.#walkableAreas; }
  get placements() { return this.#placements; }
  get exteriorWindows() { return this.#exteriorWindows; }
  get exteriorButtresses() { return this.#exteriorButtresses; }
  get buttressFootings() { return this.#buttressFootings; }
  get reservations() { return this.#reservations; }
  get stairs() { return this.#stairs; }
  get basement() { return this.#basement; }
  get serviceDoor() { return this.#serviceDoor; }
  /**
   * @returns {{center: ResidentialPoint, radius: number, rise: number}}
   */
  get serviceStair() {
    return {
      center: { x: this.#basement.access.x, y: this.#basement.floorY, z: this.#basement.access.z },
      radius: 0.45,
      rise: this.#origin.y - this.#basement.floorY,
      yaw: this.#yaw + (this.toLocal(this.#basement.access.x, this.#basement.access.z).x < (this.#rooms.work.minX + this.#rooms.work.maxX) / 2 ? 180 : 0),
    };
  }
  /**
   * Authored unit-block dimensions for the below-ground shell. The central
   * partition leaves a doorway at its front end connecting the two rooms.
   * @returns {ResidentialPlacement[]}
   */
  get basementShell() {
    const bedroom = this.#rooms.servantBedroom;
    const storage = this.#rooms.storage;
    const width = storage.maxX - bedroom.minX;
    const depth = bedroom.maxZ - bedroom.minZ;
    const centerX = (storage.maxX + bedroom.minX) / 2;
    const middle = (bedroom.minZ + bedroom.maxZ) / 2;
    const bottom = this.#basement.floorY - this.#origin.y;
    const ceiling = -0.25;
    const height = ceiling - bottom;
    const specs = [
      ["floor", centerX, middle, bottom - 0.1, width, 0.2, depth],
      ["leftWall", bedroom.minX - 0.1, middle, bottom + height / 2, 0.2, height, depth],
      ["rightWall", storage.maxX + 0.1, middle, bottom + height / 2, 0.2, height, depth],
      ["rearWall", centerX, bedroom.maxZ + 0.1, bottom + height / 2, width + 0.4, height, 0.2],
      ["frontWall", centerX, bedroom.minZ - 0.1, bottom + height / 2, width + 0.4, height, 0.2],
    ];
    const doorway = Math.min(0.8, depth / 2);
    specs.push(["partition", centerX, bedroom.minZ + doorway + (depth - doorway) / 2, bottom + height / 2, 0.1, height, depth - doorway]);
    return specs.map(/**
     * @param {Array<string|number>} spec
     */ (spec) => ({ role: spec[0], position: this.toWorld(spec[1], spec[2], spec[3]), scale: { x: spec[4], y: spec[5], z: spec[6] }, yaw: this.#yaw }));
  }

  /**
   * @param {import("./TerraceActor.js").TerraceActor|null} actor
   */
  set servant(actor) { this.#servant = actor; }

  /**
   * @param {import("./TerraceActor.js").TerraceActor|null} actor
   */
  canEnterBasement(actor) { return this.#servant !== null && actor === this.#servant; }

  /**
   * @param {number} lateral
   * @param {number} forward
   * @param {number} elevation
   */
  toWorld(lateral, forward, elevation = 0) {
    const radians = this.#yaw * Math.PI / 180;
    return { x: this.#origin.x + Math.cos(radians) * lateral + Math.sin(radians) * forward, y: this.#origin.y + elevation, z: this.#origin.z - Math.sin(radians) * lateral + Math.cos(radians) * forward };
  }

  /**
   * @param {number} x
   * @param {number} z
   */
  toLocal(x, z) {
    const radians = this.#yaw * Math.PI / 180;
    const dx = x - this.#origin.x;
    const dz = z - this.#origin.z;
    return { x: Math.cos(radians) * dx - Math.sin(radians) * dz, z: Math.sin(radians) * dx + Math.cos(radians) * dz };
  }

  /**
   * Select only a tread reachable from the caller's current level.
   * @param {number} x
   * @param {number} z
   * @param {number} currentElevation
   */
  stairSurfaceHeightAt(x, z, currentElevation) {
    const stair = this.#stairs;
    const dx = x - stair.center.x;
    const dz = z - stair.center.z;
    const distance = Math.hypot(dx, dz);
    if (distance < stair.innerRadius || distance > stair.radius * 0.59 / 0.65 || !Number.isFinite(currentElevation)) { return null; }
    let best = null;
    let difference = Number.POSITIVE_INFINITY;
    const totalAngle = stair.turns * Math.PI * 2;
    const stepAngle = totalAngle / stair.steps;
    const startAngle = Math.PI / 2 - stair.yaw * Math.PI / 180;
    const wrapped = ((startAngle - Math.atan2(dz, dx)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    for (let angle = wrapped; angle <= totalAngle; angle += Math.PI * 2) {
      const step = Math.min(stair.steps, Math.max(1, Math.ceil(angle / stepAngle)));
      const height = this.#origin.y + stair.rise * step / stair.steps;
      const heightDifference = Math.abs(height - currentElevation);
      if (heightDifference <= 0.24 && heightDifference < difference) { best = height; difference = heightDifference; }
    }
    return best;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} currentElevation
   * @param {import("./TerraceActor.js").TerraceActor|null} actor
   */
  surfaceHeightAt(x, z, currentElevation, actor = null) {
    const stairHeight = this.stairSurfaceHeightAt(x, z, currentElevation);
    if (stairHeight !== null) { return stairHeight; }
    const local = this.toLocal(x, z);
    for (const area of this.#walkableAreas) {
      if (Math.abs(area.floorY - currentElevation) <= 0.24 && local.x >= area.minX && local.x <= area.maxX && local.z >= area.minZ && local.z <= area.maxZ) return area.floorY;
    }
    for (const [name, room] of Object.entries(this.#rooms)) {
      if (["servantBedroom", "storage"].includes(name) && !this.canEnterBasement(actor)) { continue; }
      if (Math.abs(room.floorY - currentElevation) <= 0.24 && local.x >= room.minX && local.x <= room.maxX && local.z >= room.minZ && local.z <= room.maxZ) { return room.floorY; }
    }
    return null;
  }

  /**
   * @param {string} role
   * @param {number} lateral
   * @param {number} forward
   * @param {number} elevation
   * @param {number} scale
   */
  #place(role, lateral, forward, elevation, scale) {
    this.#placements.push({ role, position: this.toWorld(lateral, forward, elevation), scale: { x: scale, y: scale, z: scale }, yaw: this.#yaw });
  }
}































/**
 * Grounds each existing buttress footprint on the lowest touched terrain tile.
 * @param {import("../../GameContracts.js").CastleBuildPlan} plan
 * @param {import("../../GameContracts.js").GameMapData} mapData
 */
export const createCastleButtressFootings = (plan, mapData) => {
  const layout = new CastleResidentialLayout(plan);
  const footings = [];
  for (const placement of layout.exteriorButtresses) {
    const width = 0.6 * placement.scale.x;
    const depth = 0.6 * placement.scale.z;
    const heights = [];
    for (const dx of [-width / 2 + 0.001, 0, width / 2 - 0.001]) {
      for (const dz of [-depth / 2 + 0.001, 0, depth / 2 - 0.001]) {
        const col = Math.floor(placement.position.x + dx + mapData.cols / 2);
        const row = Math.floor(placement.position.z + dz + mapData.rows / 2);
        const height = mapData.heightmap?.[row]?.[col];
        if (Number.isFinite(height)) heights.push(height);
      }
    }
    if (!heights.length) continue;
    const baseY = Math.min(...heights);
    const topY = placement.position.y;
    if (topY > baseY + 0.001) footings.push({ x: placement.position.x,
      z: placement.position.z, baseY, topY, width, depth });
  }
  return footings;
};
