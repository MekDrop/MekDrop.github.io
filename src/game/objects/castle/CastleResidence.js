import squareWindowUrl from "../../models/castle/residential/timber-window.glb?url";
import buttressUrl from "../../models/castle/residential/corner-buttress.glb?url";
import windowUrl from "../../models/castle/residential/arched-window.glb?url";
import chimneyUrl from "../../models/castle/residential/chimney.glb?url";
import crestUrl from "../../models/castle/residential/crown-crest.glb?url";
import lanternUrl from "../../models/castle/residential/wall-lantern.glb?url";
import bookcaseUrl from "../../models/castle/residential/bookcase.glb?url";
import mapUrl from "../../models/castle/residential/framed-map.glb?url";
import floorUrl from "../../models/castle/residential/floor-panel.glb?url";
import rugUrl from "../../models/castle/residential/rug.glb?url";
import royalBedUrl from "../../models/castle/residential/royal-bed.glb?url";
import servantBedUrl from "../../models/castle/residential/servant-bed.glb?url";
import wardrobeUrl from "../../models/castle/residential/wardrobe.glb?url";
import deskUrl from "../../models/castle/residential/writing-desk.glb?url";
import shelfUrl from "../../models/castle/residential/storage-shelf.glb?url";
import chestUrl from "../../models/castle/residential/chest.glb?url";
import stairUrl from "../../models/castle/residential/spiral-staircase.glb?url";
import stoneUrl from "../../models/castle/residential/stone-block.glb?url";
import chairUrl from "../../models/castle/leisure/tea-chair.glb?url";
import { CastleResidentialLayout } from "./CastleResidentialLayout.js";
import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";

// Floor support stays traversable within the hero's automatic step height.
const FLOOR_STEP_CLEARANCE = 0.32;

const MODEL_URLS = {
  workDesk: deskUrl,
  royalBed: royalBedUrl,
  wardrobe: wardrobeUrl,
  readingChair: chairUrl,
  servantBed: servantBedUrl,
  storageShelf: shelfUrl,
};

/**
 * Castle-owned private rooms. The balcony deliberately has no participants or props.
 */
export class CastleResidence {
  /**
   * @type {import("playcanvas").StandardMaterial[]}
   */
  #gardenMaterials = [];
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {CastleResidentialLayout}
   */
  #layout;
  /**
   * @type {Array<{x: number, y: number, z: number, width: number, height: number, depth: number, floorSupport?: boolean}>}
   */
  #solids = [];
  /**
   * @type {Array<import("playcanvas").Entity>}
   */
  #stairPhysicsGraphs = [];

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [...Object.values(MODEL_URLS), chestUrl, stairUrl, stoneUrl, lanternUrl, bookcaseUrl, mapUrl, floorUrl, rugUrl, crestUrl, windowUrl, squareWindowUrl, buttressUrl, chimneyUrl];
  }

  /**
   * @param {{pc: typeof import("playcanvas"), buildPlan: import("../../GameContracts.js").CastleBuildPlan, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../GameContracts.js").CastleBuildPlan} options.buildPlan
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Texture|null} options.gardenTexture
   */
  constructor({ pc, buildPlan, modelLibrary, gardenTexture = null }) {
    this.#layout = new CastleResidentialLayout(buildPlan);
    this.#entity = new pc.Entity("Castle private rooms");
    const { origin, yaw } = this.#layout;
    this.#entity.setLocalPosition(origin.x, origin.y, origin.z);
    this.#entity.setLocalEulerAngles(0, yaw, 0);
    for (const placement of this.#layout.placements) {
      const visual = modelLibrary.instantiate(MODEL_URLS[placement.role]);
      visual.name = `Castle ${placement.role}`;
      const local = this.#layout.toLocal(placement.position.x, placement.position.z);
      visual.setLocalPosition(local.x, placement.position.y - origin.y, local.z);
      visual.setLocalEulerAngles(0, placement.yaw - yaw, 0);
      visual.setLocalScale(placement.scale.x, placement.scale.y, placement.scale.z);
      this.#entity.addChild(visual);
      // Furniture is solid at its occupied level, rather than an infinite column.
      const dimensions = {
        workDesk: [0.9, 0.73, 0.55], royalBed: [1.2, 0.75, 1.8],
        wardrobe: [0.65, 1.15, 0.46], readingChair: [0.75, 1.665, 0.735],
        servantBed: [0.8, 0.675, 1.6], storageShelf: [0.8, 1, 0.3],
      }[placement.role];
      this.#solids.push({ x: local.x, y: placement.position.y - origin.y + dimensions[1] * placement.scale.y / 2, z: local.z, width: dimensions[0] * placement.scale.x, height: dimensions[1] * placement.scale.y, depth: dimensions[2] * placement.scale.z });
    }
    this.#buildExterior(buildPlan, modelLibrary, pc);
    this.#buildBasement(pc, modelLibrary);
    this.#furnishRooms(pc, modelLibrary, buildPlan);
    this.#buildStair(pc, modelLibrary, this.#layout.stairs, "Castle compact spiral staircase");
    this.#buildStair(pc, modelLibrary, this.#layout.serviceStair, "Servant basement spiral staircase");
    this.#addUpperFloorSupport(modelLibrary, pc, gardenTexture);
    addGeneratedVoxelPhysics({ pc, parent: this.#entity, name: "Castle private room", voxels: this.#solids, friction: 0.6 });
  }

  get entity() { return this.#entity; }
  get layout() { return this.#layout; }

  /**
   * @param {import("../servant/Servant.js").Servant} servant
   */
  set servant(servant) { this.#layout.servant = servant; }

  /**
   * @param {import("../servant/Servant.js").Servant} actor
   */
  canEnterBasement(actor) { return this.#layout.canEnterBasement(actor); }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  surfaceHeightAt(x, z, elevation) {
    return this.#layout.surfaceHeightAt(x, z, elevation);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   */
  blocksMovementAt(x, z, radius, elevation) {
    const local = this.#layout.toLocal(x, z);
    // Only an actor fully below the basement ceiling needs the private-room guard.
    // Feet can sit below the work floor while crossing its entrance threshold.
    const basementCeiling = this.#layout.origin.y - 0.25;
    if (elevation + 0.8 <= basementCeiling) {
      const bed = this.#layout.rooms.servantBedroom;
      const storage = this.#layout.rooms.storage;
      const room = { ...bed, maxX: storage.maxX };
      return local.x >= room.minX - radius && local.x <= room.maxX + radius && local.z >= room.minZ - radius && local.z <= room.maxZ + radius;
    }
    const y = elevation - this.#layout.origin.y;
    return this.#solids.some(
      /**
       * @param {{x: number, y: number, z: number, width: number, height: number, depth: number, floorSupport?: boolean}} solid
       */
      (solid) => !(elevation + 0.8 > basementCeiling && solid.y + solid.height / 2 <= basementCeiling - this.#layout.origin.y + 0.001) && y + (solid.floorSupport ? FLOOR_STEP_CLEARANCE + 0.000001 : 0.02) < solid.y + solid.height / 2 && y + 0.8 > solid.y - solid.height / 2 && Math.hypot(Math.max(Math.abs(local.x - solid.x) - solid.width / 2, 0), Math.max(Math.abs(local.z - solid.z) - solid.depth / 2, 0)) < radius,
    );
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius) {
    const local = this.#layout.toLocal(x, z);
    return this.#solids.some(
      /**
       * @param {{x: number, y: number, z: number, width: number, height: number, depth: number, floorSupport?: boolean}} solid
       */
      (solid) => Math.hypot(Math.max(Math.abs(local.x - solid.x) - solid.width / 2, 0), Math.max(Math.abs(y - this.#layout.origin.y - solid.y) - solid.height / 2, 0), Math.max(Math.abs(local.z - solid.z) - solid.depth / 2, 0)) <= radius,
    );
  }

  destroy() {
    for (const material of this.#gardenMaterials) material.destroy();
    this.#entity.destroy();
    for (const graph of this.#stairPhysicsGraphs) graph.destroy();
    this.#stairPhysicsGraphs = [];
    this.#solids = [];
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {{center: {x: number, y: number, z: number}, radius: number, rise: number, yaw?: number}} definition
   * @param {string} name
   */
  #buildStair(pc, modelLibrary, definition, name) {
    const root = new pc.Entity(`${name} physics`);
    const stair = modelLibrary.instantiate(stairUrl);
    stair.name = name;
    const local = this.#layout.toLocal(definition.center.x, definition.center.z);
    root.setLocalPosition(local.x, definition.center.y - this.#layout.origin.y, local.z);
    root.setLocalEulerAngles(0, (definition.yaw ?? this.#layout.yaw) - this.#layout.yaw, 0);
    stair.setLocalScale(definition.radius / 0.65, definition.rise, definition.radius / 0.65);
    root.addChild(stair);
    this.#entity.addChild(root);
    const model = new pc.Model();
    // PlayCanvas mesh sources include each node's transform. Keep the collider
    // graph at the origin so the rigid body applies the room placement once.
    // Bake dimensions into a separate mesh. Ammo caches triangle data by mesh ID,
    // so differently scaled main and servant stairs must not share that data.
    const collisionGraph = modelLibrary.instantiateMerged(stairUrl);
    model.graph = collisionGraph;
    model.meshInstances = collisionGraph.findComponents("render").flatMap(
      /**
       * @param {import("playcanvas").RenderComponent} render
       */
      (render) => render.meshInstances,
    );
    for (const instance of model.meshInstances) {
      const source = instance.mesh;
      const positions = [];
      const indices = [];
      source.getPositions(positions);
      source.getIndices(indices);
      for (let index = 0; index < positions.length; index += 3) {
        positions[index] *= definition.radius / 0.65;
        positions[index + 1] *= definition.rise;
        positions[index + 2] *= definition.radius / 0.65;
      }
      const mesh = new pc.Mesh(source.device);
      mesh.setPositions(positions);
      mesh.setIndices(indices);
      mesh.update(pc.PRIMITIVE_TRIANGLES);
      instance.mesh = mesh;
    }
    root.addComponent("collision", { type: "mesh", model });
    root.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    this.#stairPhysicsGraphs.push(collisionGraph);
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   */
  #furnishRooms(pc, models, buildPlan) {
    const { work, bedroom } = this.#layout.rooms;
    const desk = this.#layout.reservations.find(/**
     * @param {{role: string}} reservation
     */ (reservation) => reservation.role === "workDesk");
    const deskSide = (desk.minX + desk.maxX) / 2 > (work.minX + work.maxX) / 2 ? 1 : -1;
    /**
     * @param {string} url
     * @param {string} name
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} scale
     * @param {number} yaw
     */
    const place = (url, name, x, y, z, scale = 1, yaw = 0) => {
      const entity = models.instantiate(url);
      entity.name = name;
      entity.setLocalPosition(x, y, z);
      entity.setLocalScale(scale, scale, scale);
      entity.setLocalEulerAngles(0, yaw, 0);
      this.#entity.addChild(entity);
      return entity;
    };
    for (const room of [work, bedroom]) {
      const y = room.floorY - this.#layout.origin.y;
      const back = room.maxZ - 0.22;
      // Books and the map occupy the walls, leaving the central walking route clear.
      if (room === work) {
        const shelfBack = work.minZ + (work.maxZ - work.minZ) * 0.45;
        for (const x of [deskSide > 0 ? work.maxX - 0.24 : work.minX + 0.24]) {
          const bookcase = place(bookcaseUrl, "Castle oak bookcase", x, y, shelfBack, 1, -deskSide * 90);
          bookcase.setLocalScale(1.1, 1.8 / 1.35, 1);
          this.#solids.push({ x, y: y + 0.9, z: shelfBack, width: 0.36, height: 1.8, depth: 0.935 });
        }
        const mapMount = findCastleMapMount(buildPlan, this.#layout, deskSide, shelfBack);
        if (mapMount) place(mapUrl, "Castle framed map", mapMount.x, y + 0.85, mapMount.z, 0.8, mapMount.yaw);
      }
      for (const x of [room.minX + 0.12, room.maxX - 0.12]) {
        const yaw = x < 0 ? 90 : -90;
        const forward = room.minZ + (room.maxZ - room.minZ) * 0.65;
        place(lanternUrl, "Castle warm wall lantern", x, y + 0.65, forward, 0.7, yaw);
        const light = new pc.Entity("Castle room lantern light");
        light.setLocalPosition(x + (x < 0 ? 0.25 : -0.25), y + 0.9, forward);
        light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.72, 0.38), intensity: 1.25, range: Math.min(3.5, room.maxX - room.minX), castShadows: false });
        this.#entity.addChild(light);
      }
    }
    place(crestUrl, "Castle entry crown crest", 0, 2.55, -0.17, 0.45, 180);
    const y = bedroom.floorY - this.#layout.origin.y;
    const stair = this.#layout.toLocal(this.#layout.stairs.center.x, this.#layout.stairs.center.z);
    const radius = this.#layout.stairs.radius;
    for (let x = bedroom.minX; x < bedroom.maxX - 0.001; x += 0.5) {
      for (let z = bedroom.minZ; z < bedroom.maxZ - 0.001; z += 0.5) {
        const w = Math.min(0.5, bedroom.maxX - x);
        const d = Math.min(0.5, bedroom.maxZ - z);
        if (x < stair.x + radius && x + w > stair.x - radius && z < stair.z + radius && z + d > stair.z - radius) continue;
        const panel = place(floorUrl, "Bedroom oak parquet panel", x + w / 2, y + 0.002, z + d / 2);
        panel.setLocalScale(w, 0.3, d);
      }
    }
    const rug = place(rugUrl, "Bedroom embroidered rug", (bedroom.minX + bedroom.maxX) / 2, y + 0.022, (bedroom.minZ + bedroom.maxZ) / 2, 0.55);
    rug.setLocalScale(0.7, 0.55, 0.55);
  }

  /**
   * Closed window ornaments sit on exterior masonry; existing walls remain solid.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   */
  #buildExterior(buildPlan, models, pc) {
    const { origin, yaw } = this.#layout;
    for (const placement of this.#layout.exteriorWindows) {
      const window = models.instantiate(placement.role !== "archedWindow" ? squareWindowUrl : windowUrl);
      window.name = placement.role !== "archedWindow" ? "Castle closed timber window" : "Castle closed arched window";
      const local = this.#layout.toLocal(placement.position.x, placement.position.z);
      window.setLocalPosition(local.x, placement.position.y - origin.y, local.z);
      window.setLocalEulerAngles(0, placement.yaw - yaw, 0);
      window.setLocalScale(placement.scale.x, placement.scale.y, placement.scale.z);
      this.#entity.addChild(window);
      if (placement.role === "squareWindow") {
        const angle = (placement.yaw - yaw) * Math.PI / 180;
        const flank = local.x < 0 ? -1 : 1;
        const tangentX = Math.cos(angle) * flank * 0.48;
        const tangentZ = -Math.sin(angle) * flank * 0.48;
        const x = local.x + tangentX + Math.sin(angle) * 0.12;
        const z = local.z + tangentZ + Math.cos(angle) * 0.12;
        const y = placement.position.y - origin.y + 0.25;
        const lantern = models.instantiate(lanternUrl);
        lantern.name = "Castle exterior wall lantern";
        lantern.setLocalPosition(x, y, z);
        lantern.setLocalEulerAngles(0, placement.yaw - yaw, 0);
        lantern.setLocalScale(0.75, 0.75, 0.75);
        this.#entity.addChild(lantern);
        const light = new pc.Entity("Castle exterior lantern light");
        light.setLocalPosition(x + Math.sin(angle) * 0.2, y + 0.2, z + Math.cos(angle) * 0.2);
        light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.65, 0.25), intensity: 1.1, range: 2, castShadows: false });
        this.#entity.addChild(light);
      }


    }
    for (const placement of this.#layout.exteriorButtresses) {
      const local = this.#layout.toLocal(placement.position.x, placement.position.z);
      const visual = models.instantiate(buttressUrl);
      visual.name = placement.role === "outerButtress" ? "Castle outer tower buttress" : "Castle stepped corner buttress";
      visual.setLocalPosition(local.x, placement.position.y - origin.y, local.z);
      visual.setLocalEulerAngles(0, placement.yaw - yaw, 0);
      visual.setLocalScale(placement.scale.x, placement.scale.y, placement.scale.z);
      this.#entity.addChild(visual);
      this.#solids.push({ x: local.x, y: 0.7 * placement.scale.y, z: local.z,
        width: 0.6 * placement.scale.x, height: 1.4 * placement.scale.y, depth: 0.6 * placement.scale.z });
    }
    for (const footing of this.#layout.buttressFootings) {
      const local = this.#layout.toLocal(footing.x, footing.z);
      const height = footing.topY - footing.baseY;
      const y = (footing.topY + footing.baseY) / 2 - origin.y;
      const visual = models.instantiate(stoneUrl);
      visual.name = "Castle grounded buttress footing";
      visual.setLocalPosition(local.x, y, local.z);
      visual.setLocalScale(footing.width, height, footing.depth);
      this.#entity.addChild(visual);
      this.#solids.push({ x: local.x, y, z: local.z, width: footing.width, height, depth: footing.depth });
    }
    const residential = buildPlan.metadata.runtime.residential;
    for (const chimney of residential?.chimneys ?? [residential?.chimney].filter(Boolean)) {
      const visual = models.instantiate(chimneyUrl);
      visual.name = "Castle masonry chimney";
      const local = this.#layout.toLocal(chimney.x, chimney.z);
      visual.setLocalPosition(local.x, chimney.y - origin.y, local.z);
      visual.setLocalEulerAngles(0, chimney.yaw - yaw, 0);
      visual.setLocalScale(chimney.width / 0.65, chimney.height / 1.5, chimney.depth / 0.65);
      this.#entity.addChild(visual);
      this.#solids.push({ x: local.x, y: chimney.y - origin.y + chimney.height / 2, z: local.z, width: chimney.width, height: chimney.height, depth: chimney.depth });
    }
  }
  /**
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Texture|null} gardenTexture
   */
  #addUpperFloorSupport(modelLibrary, pc, gardenTexture) {
    if (gardenTexture) {
      gardenTexture.addressU = pc.ADDRESS_REPEAT;
      gardenTexture.addressV = pc.ADDRESS_REPEAT;
    }
    const threshold = this.#layout.walkableAreas.find(/**
     * @param {{id: string}} area
     */ (area) => area.id === "mainDoorThreshold");
    const stone = modelLibrary.instantiate(stoneUrl);
    stone.name = "Castle main entrance threshold";
    stone.setLocalScale(threshold.maxX - threshold.minX, 0.25, threshold.maxZ - threshold.minZ);
    stone.setLocalPosition((threshold.minX + threshold.maxX) / 2, -0.25, (threshold.minZ + threshold.maxZ) / 2);
    this.#entity.addChild(stone);
    const { bedroom, balcony, stairLanding, sideTerrace } = this.#layout.rooms;
    for (const room of [bedroom, balcony, stairLanding, sideTerrace, ...this.#layout.walkableAreas].filter(Boolean)) {
      if (room.id === "serviceStairLanding") continue;
      if (["mainStairLanding", "serviceDoorThreshold"].includes(room.id)) {
        const x = (room.minX + room.maxX) / 2;
        const z = (room.minZ + room.maxZ) / 2;
        const y = room.floorY - this.#layout.origin.y;
        const width = room.maxX - room.minX;
        const depth = room.maxZ - room.minZ;
        const stoneLanding = room.id !== "mainStairLanding";
        const panel = modelLibrary.instantiate(stoneLanding ? stoneUrl : floorUrl);
        panel.name = room.id === "serviceDoorThreshold" ? "Castle service entrance stone landing" : "Castle spiral upper landing";
        panel.setLocalPosition(x, stoneLanding ? y - 0.25 : y - 0.018, z);
        panel.setLocalScale(width, stoneLanding ? 0.25 : 0.3, depth);
        this.#entity.addChild(panel);
        this.#solids.push({ x, y: y - 0.125, z, width, height: 0.25, depth, floorSupport: true });
        continue;
      }
      const ground = room.floorY <= this.#layout.origin.y + 0.001;
      const shaft = ground ? this.#layout.serviceStair : this.#layout.stairs;
      const center = this.#layout.toLocal(shaft.center.x, shaft.center.z);
      const radius = shaft.radius + (ground ? 0.1 : 0);
      const left = Math.max(room.minX, center.x - radius);
      const right = Math.min(room.maxX, center.x + radius);
      const front = Math.max(room.minZ, center.z - radius);
      const rear = Math.min(room.maxZ, center.z + radius);
      const exit = ground ? this.#layout.walkableAreas.find(/**
       *
       * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number}} area
       */
      (area) => area.id === "serviceStairLanding") : null;
      // Continue the room floor into the final tread's exit quadrant, using
      // the same surface and thickness as the rest of the room.
      let rectangles = right > left && rear > front ? [
        [room.minX, left, room.minZ, room.maxZ],
        [right, room.maxX, room.minZ, room.maxZ],
        [left, right, room.minZ, front],
        [left, right, rear, room.maxZ],
      ] : [[room.minX, room.maxX, room.minZ, room.maxZ]];
      if (exit && right > left && rear > front) {
        rectangles.push([Math.max(left, exit.minX), Math.min(right, exit.maxX),
          Math.max(front, exit.minZ), Math.min(rear, exit.maxZ)]);
      }
      // The audience room owns its timber finish. Door landings and the garden
      // also own their surfaces; overlapping panels flicker at oblique angles.
      if (room.id === "castleGroundFloor" || room.id === "serviceGroundBay") {
        const exclusions = [this.#layout.rooms.work,
          ...this.#layout.walkableAreas.filter(/**
           *
           * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number}} area
           */
          (area) => area.id === "courtyard" ||
            area.id.endsWith("Threshold") || area.id.startsWith("doorThreshold") ||
            (room.id === "castleGroundFloor" && area.id === "serviceGroundBay"))];
        for (const area of exclusions) rectangles = subtractFloorArea(rectangles, area);
      }
      if (room.id === "courtyard") {
        // Stone thresholds pass through the garden. They own those patches;
        // the grass finish must stop at their edges rather than share a plane.
        for (const area of [this.#layout.rooms.work,
          ...this.#layout.walkableAreas.filter(/**
           * @param {{id:string}} area
           */
          (area) => area.id.endsWith("Threshold") || area.id.startsWith("doorThreshold") || area.id === "serviceGroundBay")]) {
          rectangles = subtractFloorArea(rectangles, area);
        }
      }
      for (const [minX, maxX, minZ, maxZ] of rectangles) {
        if (maxX <= minX || maxZ <= minZ) continue;
        if (room.id === "courtyard" || room.id === "castleGroundFloor" || room.id === "serviceGroundBay" || room.id?.startsWith("interiorFloor:")) {
          const panel = modelLibrary.instantiate(floorUrl);
          const garden = room.id === "courtyard";
          panel.name = garden ? "Castle garden grass surface" : "Castle enclosed room wooden floor";
          // The authored panel is bottom anchored and 0.06 metres thick.
          panel.setLocalPosition((minX + maxX) / 2, room.floorY - this.#layout.origin.y - 0.06, (minZ + maxZ) / 2);
          panel.setLocalScale(maxX - minX, 1, maxZ - minZ);
          if (garden) {
            for (const render of panel.findComponents("render")) {
              for (const mesh of render.meshInstances) {
                mesh.material = mesh.material.clone();
                mesh.material.diffuse = new pc.Color(1, 1, 1);
                mesh.material.diffuseMap = gardenTexture;
                mesh.material.diffuseMapTiling = new pc.Vec2(maxX - minX, maxZ - minZ);
                mesh.material.update();
                this.#gardenMaterials.push(mesh.material);
              }
            }
          }
          this.#entity.addChild(panel);
        }
        this.#solids.push({ x: (minX + maxX) / 2, y: room.floorY - this.#layout.origin.y - 0.125, z: (minZ + maxZ) / 2, width: maxX - minX, height: 0.25, depth: maxZ - minZ, floorSupport: true });
      }
    }
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   */
  #buildBasement(pc, modelLibrary) {
    const { servantBedroom: bed, storage } = this.#layout.rooms;
    const y = bed.floorY - this.#layout.origin.y;
    const width = storage.maxX - bed.minX;
    const depth = bed.maxZ - bed.minZ;
    const centerX = (bed.minX + storage.maxX) / 2;
    const centerZ = (bed.minZ + bed.maxZ) / 2;
    const height = -y - 0.25;
    const boxes = [
      { x: centerX, y: y - 0.125, z: centerZ, width, height: 0.25, depth },
      { x: bed.minX - 0.125, y: y + height / 2, z: centerZ, width: 0.25, height, depth },
      { x: storage.maxX + 0.125, y: y + height / 2, z: centerZ, width: 0.25, height, depth },
      { x: centerX, y: y + height / 2, z: bed.maxZ + 0.125, width, height, depth: 0.25 },
      { x: centerX, y: y + height / 2, z: bed.minZ - 0.125, width, height, depth: 0.25 },
      // Partition leaves a doorway at its front end.
      { x: centerX, y: y + height / 2, z: bed.minZ + 0.8 + (depth - 0.8) / 2, width: 0.1, height, depth: Math.max(0.1, depth - 0.8) },
    ];
    for (const box of boxes) {
      const floor = box === boxes[0];
      const wall = modelLibrary.instantiate(floor ? floorUrl : stoneUrl);
      wall.name = floor ? "Castle basement wooden floor" : "Castle basement masonry";
      wall.setLocalPosition(box.x, floor ? y - 0.06 : box.y - box.height / 2, box.z);
      wall.setLocalScale(box.width, floor ? 1 : box.height, box.depth);
      this.#entity.addChild(wall);
      this.#solids.push(box);
    }
    const chest = modelLibrary.instantiate(chestUrl);
    chest.name = "Servant clothes chest";
    chest.setLocalPosition(bed.minX + 0.4, y, bed.maxZ - 0.3);
    chest.setLocalScale(0.65, 0.65, 0.65);
    this.#entity.addChild(chest);
    const light = new pc.Entity("Servant cellar lantern light");
    light.setLocalPosition(centerX, y + height - 0.25, centerZ);
    light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.72, 0.4), intensity: 1.4, range: Math.max(width, depth) + 1, castShadows: false });
    this.#entity.addChild(light);
  }
}















/**
 * Find continuous masonry behind the entire authored .89m frame at .8 scale.
 * Sampling includes an edge margin; doorway voids and short pillars fail support.
 * @param {import("../../GameContracts.js").CastleBuildPlan} plan
 * @param {CastleResidentialLayout} layout
 * @param {number} preferredSide
 * @param {number} shelfBack
 */
export function findCastleMapMount(plan, layout, preferredSide, shelfBack) {
  const work = layout.rooms.work;
  const blocks = plan.metadata.collision?.cameraBlocks ?? [];
  for (const side of [preferredSide, -preferredSide]) {
    const wallX = side > 0 ? work.maxX : work.minX;
    for (let z = work.minZ + 0.46; z <= work.maxZ - 0.46; z += 0.05) {
      if (side === preferredSide && Math.abs(z - shelfBack) < 0.92) continue;
      let supported = true;
      for (let across = -0.44; across <= 0.440001 && supported; across += 0.04) {
        for (let height = 0.8; height <= 1.560001; height += 0.04) {
          const point = layout.toWorld(wallX + side * 0.08, z + across, height);
          if (!blocks.some(/**
           * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
           */ (block) => Math.abs(point.x - block.x) <= block.halfX + 0.000001 &&
              Math.abs(point.y - block.y) <= block.halfY + 0.000001 &&
              Math.abs(point.z - block.z) <= block.halfZ + 0.000001)) {
            supported = false;
            break;
          }
        }
      }
      if (supported) return { x: wallX - side * 0.035, z, yaw: -side * 90 };
    }
  }
  return null;
}

/**
 * Split floor rectangles around another surface with exclusive ownership.
 * @param {number[][]} rectangles
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} area
 * @returns {number[][]}
 */
function subtractFloorArea(rectangles, area) {
  return rectangles.flatMap(/**
   *
   * @param {number[]} options
   * @param {number} options."0"
   * @param {number} options."1"
   * @param {number} options."2"
   * @param {number} options."3"
   */
  ([minX, maxX, minZ, maxZ]) => {
    const left = Math.max(minX, area.minX), right = Math.min(maxX, area.maxX);
    const front = Math.max(minZ, area.minZ), rear = Math.min(maxZ, area.maxZ);
    if (right <= left || rear <= front) return [[minX, maxX, minZ, maxZ]];
    return [[minX, left, minZ, maxZ], [right, maxX, minZ, maxZ],
      [left, right, minZ, front], [left, right, rear, maxZ]];
  });
}
