import { createSpiralStairCollision, spiralStairRise } from "../shared/SpiralStairCollision.js";
import buttressUrl from "../../models/castle/residential/corner-buttress.glb?url";
import chimneyUrl from "../../models/castle/residential/chimney.glb?url";
import crestUrl from "../../models/castle/residential/crown-crest.glb?url";
import lanternUrl from "../../models/castle/residential/wall-lantern.glb?url";
import { Bookshelf } from "../bookshelf/Bookshelf.js";
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
import stairModuleUrl from "../../models/castle/stairs/castle-stair-module.glb?url";
import masonryBlockUrl from "../../models/castle/residential/masonry-block.glb?url";
import { castleStraightStairSurfaces, castleStraightStairStepCount } from "./CastleStraightStairs.js";

// Floor support stays traversable within the hero's automatic step height.
const FLOOR_STEP_CLEARANCE = 0.32;

const MODEL_URLS = {
  workDesk: deskUrl,
  kitchenTable: deskUrl,
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
   * Stair walls own Ammo bodies separately from the generated room solids.
   * @type {Array<{x:number,y:number,z:number,width:number,height:number,depth:number}>}
   */
  #stairCameraSolids = [];
  /**
   * @type {Array<import("playcanvas").Entity>}
   */
  #stairPhysicsGraphs = [];
  /**
   * @type {import("playcanvas").Mesh[]}
   */
  #stairProfileMeshes = [];
  /**
   * @type {import("playcanvas").MeshInstance[]}
   */
  #stairSupportInstances = [];
  /**
   * @type {Map<string,import("playcanvas").StandardMaterial>}
   */
  #stairMaterials;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [...Object.values(MODEL_URLS), chestUrl, stairUrl, stairModuleUrl, masonryBlockUrl, stoneUrl, lanternUrl, ...Bookshelf.modelUrls, floorUrl, rugUrl, crestUrl, buttressUrl, chimneyUrl];
  }

  /**
   * @param {{pc: typeof import("playcanvas"), buildPlan: import("../../GameContracts.js").CastleBuildPlan, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../GameContracts.js").CastleBuildPlan} options.buildPlan
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {Map<string,import("playcanvas").StandardMaterial>} options.stairMaterials
   * @param {import("playcanvas").Texture|null} options.gardenTexture
   */
  constructor({ pc, buildPlan, modelLibrary, gardenTexture = null, stairMaterials = new Map() }) {
    this.#stairMaterials = stairMaterials;
    this.#layout = new CastleResidentialLayout(buildPlan);
    this.#entity = new pc.Entity("Castle private rooms");
    const { origin, yaw } = this.#layout;
    this.#entity.setLocalPosition(origin.x, origin.y, origin.z);
    this.#entity.setLocalEulerAngles(0, yaw, 0);
    for (const placement of this.#layout.placements) {
      if (placement.role === "bookshelf") { continue; }
      const visual = modelLibrary.instantiate(MODEL_URLS[placement.role]);
      visual.name = `Castle ${placement.role}`;
      const local = this.#layout.toLocal(placement.position.x, placement.position.z);
      visual.setLocalPosition(local.x, placement.position.y - origin.y, local.z);
      visual.setLocalEulerAngles(0, placement.yaw - yaw, 0);
      visual.setLocalScale(placement.scale.x, placement.scale.y, placement.scale.z);
      this.#entity.addChild(visual);
      // Furniture is solid at its occupied level, rather than an infinite column.
      const dimensions = {
        workDesk: [0.9, 0.73, 0.55], kitchenTable: [0.9, 0.73, 0.55], royalBed: [1.2, 0.75, 1.8],
        wardrobe: [0.65, 1.15, 0.46], readingChair: [0.75, 1.665, 0.735],
        servantBed: [0.8, 0.675, 1.6], storageShelf: [0.8, 1, 0.3],
      }[placement.role];
      this.#solids.push({ x: local.x, y: placement.position.y - origin.y + dimensions[1] * placement.scale.y / 2, z: local.z, width: dimensions[0] * placement.scale.x, height: dimensions[1] * placement.scale.y, depth: dimensions[2] * placement.scale.z });
    }
    if (buildPlan.metadata.runtime.residential?.version === 2) {
      if (!buildPlan.metadata.runtime.residential.basePlanId) { this.#buildExterior(buildPlan, modelLibrary, pc); }
      this.#buildPlannedFloors(buildPlan, modelLibrary, pc);
      for (const stair of this.#layout.authoredStairs) { this.#buildStair(pc, modelLibrary, stair, "Castle authored staircase", stair.shaft); }
      if (this.#layout.stairs) { this.#buildStair(pc, modelLibrary, this.#layout.stairs, "Castle upper staircase", buildPlan.metadata.runtime.residential.shaft); }
      if (this.#layout.serviceStair) { this.#buildStair(pc, modelLibrary, this.#layout.serviceStair, "Castle basement staircase"); }
      addGeneratedVoxelPhysics({ pc, parent: this.#entity, name: "Castle rooms", voxels: this.#solids, friction: 0.6 });
      return;
    }
    this.#buildExterior(buildPlan, modelLibrary, pc);
    this.#buildBasement(pc, modelLibrary);
    this.#furnishRooms(pc, modelLibrary, buildPlan);
    this.#buildStair(pc, modelLibrary, this.#layout.stairs, "Castle compact spiral staircase");
    this.#buildStair(pc, modelLibrary, this.#layout.serviceStair, "Servant basement spiral staircase");
    this.#addUpperFloorSupport(modelLibrary, pc, gardenTexture);
    addGeneratedVoxelPhysics({ pc, parent: this.#entity, name: "Castle private room", voxels: this.#solids, friction: 0.6 });
  }

  /**
   * Floors and light use the same planned bounds as walls and furniture.
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {typeof import("playcanvas")} pc
   */
  #buildPlannedFloors(buildPlan, models, pc) {
    const plan = buildPlan.metadata.runtime.residential;
    for (const area of this.#layout.walkableAreas) {
      const rooms = plan.placedRooms.filter(/**
       * @param {import("../../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
       */ (room) => room.id !== "leisure" && area.floorY >= room.floorY && area.floorY < room.floorY + room.height);
      let stonePieces = [[area.minX, area.maxX, area.minZ, area.maxZ]];
      const woodPieces = [];
      for (const room of rooms) {
        const intersection = [Math.max(area.minX, room.minX), Math.min(area.maxX, room.maxX),
          Math.max(area.minZ, room.minZ), Math.min(area.maxZ, room.maxZ)];
        stonePieces = subtractFloorArea(stonePieces, room);
        // The audience-room object owns its ground-floor timber.
        if (room.id !== "throneRoom" || area.floorY !== plan.origin.y) { woodPieces.push(intersection); }
      }
      for (const [pieces, timber] of [[stonePieces, false], [woodPieces, true]]) {
        // The generated brick shell already owns exposed upper surfaces.
        if (!plan.basePlanId && !timber && area.floorY > plan.origin.y && !area.id.endsWith("Threshold")) { continue; }
        for (const [minX, maxX, minZ, maxZ] of pieces) {
          if (maxX <= minX || maxZ <= minZ) { continue; }
          // Door thresholds already have masonry and exterior stair support.
          // Keep their support record without adding another visible slab.
          const threshold = area.id.endsWith("Threshold");
          const wood = timber && !threshold;
          const panel = models.instantiate(wood ? floorUrl : stoneUrl);
          const x = (minX + maxX) / 2;
          const z = (minZ + maxZ) / 2;
          const y = area.floorY - plan.origin.y;
          if (panel && (wood || !plan.basePlanId)) {
            panel.name = `Castle ${area.id} ${wood ? "wood" : "stone"} floor`;
            // Keep finishes clear of terrain and the final stone tread.
            panel.setLocalPosition(x, y - (wood ? 0.06 : 0.25) + 0.004, z);
            panel.setLocalScale(maxX - minX, wood ? 1 : 0.25, maxZ - minZ);
            this.#entity.addChild(panel);
          }
          // Authored masonry already owns the slab, including its underside.
          // A second backing shares its bottom face and flickers in first person.
          if (wood && !plan.basePlanId) {
            const backing = models.instantiate(stoneUrl);
            backing.name = `Castle ${area.id} structural floor backing`;
            backing.setLocalPosition(x, y - 0.25, z);
            backing.setLocalScale(maxX - minX, 0.214, maxZ - minZ);
            this.#entity.addChild(backing);
          }
          this.#solids.push({ x, y: y - 0.125, z, width: maxX - minX,
            height: 0.25, depth: maxZ - minZ, floorSupport: true });
        }
      }
    }

    for (const item of plan.furniture) {
      if (item.role !== "bookshelf") { continue; }
      this.#solids.push(Bookshelf.addVisual(models, this.#entity, {
        id: `castle-${item.roomId}-books`, object: Bookshelf.name,
        from: { x: item.x, y: item.floorY - plan.origin.y, z: item.z - item.depth * item.scale / 2 },
        to: { x: item.x, y: item.floorY - plan.origin.y, z: item.z + item.depth * item.scale / 2 },
        height: 1.6, facing: item.x < 0 ? 1 : -1,
      }));
    }
    for (const room of plan.placedRooms) {
      const light = new pc.Entity(`Castle ${room.id} light`);
      light.setLocalPosition((room.minX + room.maxX) / 2, room.floorY - plan.origin.y + 1.7, (room.minZ + room.maxZ) / 2);
      light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.72, 0.4),
        intensity: 1.2, range: 4, castShadows: false });
      this.#entity.addChild(light);
    }
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
    if (this.#layout.basement && elevation + 0.8 <= basementCeiling) {
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
    return [...this.#solids, ...this.#stairCameraSolids].some(
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
    for (const instance of this.#stairSupportInstances) instance.destroy();
    this.#stairSupportInstances = [];
    for (const mesh of this.#stairProfileMeshes) mesh.destroy();
    this.#stairProfileMeshes = [];
    this.#solids = [];
    this.#stairCameraSolids = [];
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {{center: {x: number, y: number, z: number}, radius: number, rise: number, yaw?: number, turns?: number, landingProfile?: boolean}} definition
   * @param {string} name
   * @param {{minZ:number,maxZ:number}|null} shaft
   */
  #buildStair(pc, modelLibrary, definition, name, shaft = null) {
    if (definition.straight) {
      this.#buildStraightStair(pc, modelLibrary, definition);
      return;
    }
    const root = new pc.Entity(`${name} physics`);
    const stair = modelLibrary.instantiate(stairUrl);
    stair.name = name;
    const landingProfile = definition.landingProfile ?? false;
    const turns = definition.turns ?? 1.5;
    if (landingProfile || turns !== 1.5) this.#stairProfileMeshes.push(...reshapeSpiralModel(pc, stair, shaft, definition.radius, landingProfile, turns));
    const entranceRails = new Set(["Handrail", "Handrail.001", "Handrail.022", "Handrail.023",
      "Rail post", "Rail post.001", "Rail post.022", "Rail post.023",
      "Rail tread connection 00", "Rail tread connection 01", "Rail tread connection 22", "Rail tread connection 23"]);
    for (const render of stair.findComponents("render")) {
      if (entranceRails.has(render.entity.name)) { render.enabled = false; }
    }
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
    const collisionGraph = modelLibrary.instantiate(stairUrl);
    if (landingProfile || turns !== 1.5) this.#stairProfileMeshes.push(...reshapeSpiralModel(pc, collisionGraph, shaft, definition.radius, landingProfile, turns));
    model.graph = collisionGraph;
    model.meshInstances = collisionGraph.findComponents("render").flatMap(
      /**
       * @param {import("playcanvas").RenderComponent} render
       */
      (render) => entranceRails.has(render.entity.name) || render.entity.name.startsWith("Stone tread") ? [] : render.meshInstances,
    );
    const rootInverse = new pc.Mat4().copy(collisionGraph.getWorldTransform()).invert();
    const point = new pc.Vec3();
    for (const instance of model.meshInstances) {
      const source = instance.mesh;
      const positions = [];
      const indices = [];
      source.getPositions(positions);
      source.getIndices(indices);
      const transform = new pc.Mat4().mul2(rootInverse, instance.node.getWorldTransform());
      for (let index = 0; index < positions.length; index += 3) {
        point.set(positions[index], positions[index + 1], positions[index + 2]);
        transform.transformPoint(point, point);
        positions[index] = point.x * definition.radius / 0.65;
        positions[index + 1] = point.y * definition.rise;
        positions[index + 2] = point.z * definition.radius / 0.65;
      }
      const mesh = new pc.Mesh(source.device);
      mesh.setPositions(positions);
      mesh.setIndices(indices);
      mesh.update(pc.PRIMITIVE_TRIANGLES);
      instance.mesh = mesh;
    }
    for (const instance of model.meshInstances) {
      instance.node.setLocalPosition(0, 0, 0);
      instance.node.setLocalEulerAngles(0, 0, 0);
      instance.node.setLocalScale(1, 1, 1);
    }
    const support = createSpiralStairCollision(pc, {
      device: model.meshInstances[0].mesh.device, material: model.meshInstances[0].material,
      innerRadius: definition.radius * 0.08 / 0.65, outerRadius: definition.radius * 0.59 / 0.65,
      rise: definition.rise, turns, steps: 24, landingProfile,
    });
    this.#stairSupportInstances.push(support);
    collisionGraph.addChild(support.node);
    model.meshInstances.push(support);
    root.addComponent("collision", { type: "mesh", model });
    root.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    this.#stairPhysicsGraphs.push(collisionGraph);
  }

  /**
   * Stone modules and flat Ammo tread tops share the same step dimensions.
   * The hero can climb using its automatic step lift and rest on each tread.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {{center:{x:number,y:number,z:number},yaw:number,radius:number,rise:number,flightGap?:number}} stair
   */
  #buildStraightStair(pc, models, stair) {
    const root = new pc.Entity("Castle straight staircase");
    root.tags.add("capsule-support");
    const local = this.#layout.toLocal(stair.center.x, stair.center.z);
    root.setLocalPosition(local.x, stair.center.y - this.#layout.origin.y, local.z);
    root.setLocalEulerAngles(0, stair.yaw - this.#layout.yaw, 0);
    this.#entity.addChild(root);
    const positions = [], indices = [];
    for (const surface of castleStraightStairSurfaces(stair)) {
      const run = surface.maxZ - surface.minZ;
      const rise = surface.high - surface.low;
      // Turning landings use the castle's quarter-metre masonry courses.
      const steps = castleStraightStairStepCount(surface);
      // The generated upper landing owns the flat exit's visible surface.
      // Retain its flat collision support without drawing another tread layer.
      const drawSurface = rise > 0 || surface.high < stair.rise;
      for (let step = 0; drawSurface && step < steps; step++) {
        const columns = Math.max(1, Math.round((surface.maxX - surface.minX) / 0.25));
        const width = (surface.maxX - surface.minX) / columns;
        const height = surface.low + rise * (step + 1) / steps;
        const thickness = rise ? rise / steps : 0.25;
        const z = surface.reverse ? surface.maxZ - run * (step + 0.5) / steps : surface.minZ + run * (step + 0.5) / steps;
        for (let column = 0; column < columns; column++) {
          // Preserve the GLB root pivot: the masonry block starts at Y=0,
          // while the stair module is centred on Y=0.
          const tread = new pc.Entity();
          tread.addChild(models.instantiate(rise ? stairModuleUrl : masonryBlockUrl));
          tread.name = rise ? "Castle straight stone tread" : "Castle stair turning landing";
          tread.setLocalPosition(surface.minX + width * (column + 0.5), height - (rise ? thickness / 2 : thickness), z);
          tread.setLocalScale(width, thickness, run / steps / (rise ? 2 : 1));
          const material = this.#stairMaterials.get((step + column * 3) % 8 === 0 ? "castleStoneDark" : "castleStoneMid");
          if (material) {
            for (const render of tread.findComponents("render")) {
              for (const instance of render.meshInstances) { instance.material = material; }
            }
          }
          root.addChild(tread);
        }
      }
      // Flat Ammo tread tops support an idle hero instead of a slippery ramp.
      for (let step = 0; step < steps; step++) {
        const front = surface.reverse ? surface.maxZ - run * (step + 1) / steps : surface.minZ + run * step / steps;
        const rear = front + run / steps;
        const height = surface.low + rise * (step + 1) / steps;
        const offset = positions.length / 3;
        positions.push(surface.minX, height, front, surface.minX, height, rear,
          surface.maxX, height, rear, surface.maxX, height, front);
        indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        if (rise > 0) {
          const edge = surface.reverse ? rear : front;
          const bottom = surface.low + rise * step / steps;
          const wall = positions.length / 3;
          positions.push(surface.minX, bottom, edge, surface.minX, height, edge,
            surface.maxX, height, edge, surface.maxX, bottom, edge);
          indices.push(wall, wall + 1, wall + 2, wall, wall + 2, wall + 3,
            wall + 2, wall + 1, wall, wall + 3, wall + 2, wall);
        }
      }
    }
    const mesh = new pc.Mesh(this.#entity.findComponents("render")[0].meshInstances[0].mesh.device);
    mesh.setPositions(positions);
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const graph = new pc.GraphNode("Castle straight stair support");
    const model = new pc.Model();
    model.graph = graph;
    const material = root.findComponents("render")[0].meshInstances[0].material;
    const support = new pc.MeshInstance(mesh, material, graph);
    model.meshInstances = [support];
    this.#stairSupportInstances.push(support);
    this.#stairPhysicsGraphs.push(graph);
    root.addComponent("collision", { type: "mesh", model });
    root.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    this.#buildStairDivider(pc, models, root, stair);
  }

  /**
   * Reuse the castle masonry kit, leaving the turning landing open
   * so both flights remain connected around the divider.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} root
   * @param {{radius:number,rise:number,flightGap?:number}} stair
   */
  #buildStairDivider(pc, models, root, stair) {
    const flight = castleStraightStairSurfaces(stair)[0];
    const minZ = flight.minZ;
    const maxZ = flight.maxZ;
    const length = maxZ - minZ;
    if (length <= 0) { return; }
    const topY = stair.center.y + stair.rise;
    const local = this.#layout.toLocal(stair.center.x, stair.center.z);
    const nextFlight = this.#layout.authoredStairs.some(/**
     * @param {{center:{x:number,y:number,z:number}}} next
     */ next =>
      Math.abs(next.center.y - topY) < 0.001 &&
      Math.hypot(next.center.x - stair.center.x, next.center.z - stair.center.z) < 0.001);
    // Lower segments meet at floor height; the final segment ends at
    // the same 75 cm guard height as the top-floor half wall.
    const height = stair.rise + (nextFlight ? 0 : 0.75);
    const divider = new pc.Entity("Castle stair brick divider");
    divider.setLocalPosition(0, height / 2, (minZ + maxZ) / 2);
    root.addChild(divider);
    const courses = Math.max(1, Math.ceil(height / 0.25));
    const courseHeight = height / courses;
    const columns = Math.max(1, Math.ceil(length / 0.25));
    const brickLength = length / columns;
    for (let row = 0; row < courses; row++) {
      for (let column = 0; column < columns; column++) {
        const shade = (row + column * 3) % 8;
        const material = this.#stairMaterials.get(shade === 0 || shade === 7 ? "castleStoneDark" : "castleStoneMid");
        const brick = models.instantiateMerged(masonryBlockUrl, { material, linearVertexColors: true });
        brick.setLocalPosition(0, -height / 2 + row * courseHeight,
          -length / 2 + (column + 0.5) * brickLength);
        brick.setLocalScale(0.25, courseHeight, brickLength);
        divider.addChild(brick);
      }
    }
    divider.addComponent("collision", {
      type: "box", halfExtents: new pc.Vec3(0.125, height / 2, length / 2),
    });
    divider.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    const angle = (stair.yaw - this.#layout.yaw) * Math.PI / 180;
    const sine = Math.round(Math.sin(angle)), cosine = Math.round(Math.cos(angle));
    const middleZ = (minZ + maxZ) / 2;
    this.#stairCameraSolids.push({
      x: local.x + middleZ * sine, z: local.z + middleZ * cosine,
      y: stair.center.y - this.#layout.origin.y + height / 2, height,
      width: Math.abs(cosine) * 0.25 + Math.abs(sine) * length,
      depth: Math.abs(sine) * 0.25 + Math.abs(cosine) * length,
    });
    if (!nextFlight) { this.#buildStairOpeningGuard(pc, models, root, stair, flight.minX); }
  }

  /**
   * A plain terrace-height guard closes the upper floor's drop beside the
   * divider. Intermediate floors stay open for the next ascending flight.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} root
   * @param {{radius:number,rise:number}} stair
   * @param {number} minX
   */
  #buildStairOpeningGuard(pc, models, root, stair, minX) {
    const height = 0.75, maxX = -0.125, width = maxX - minX, depth = 0.125;
    const guard = new pc.Entity("Castle stair opening half wall");
    guard.setLocalPosition((minX + maxX) / 2, stair.rise + height / 2, stair.radius + (stair.flightShift ?? 0) - depth / 2);
    root.addChild(guard);
    const columns = Math.max(1, Math.ceil(width / 0.5));
    const brickWidth = width / columns;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < columns; column++) {
        const brick = models.instantiateMerged(stoneUrl, {
          material: this.#stairMaterials.get("castleStoneMid"), linearVertexColors: true,
        });
        brick.setLocalPosition(-width / 2 + brickWidth * (column + 0.5), -height / 2 + row * 0.25, 0);
        brick.setLocalScale(brickWidth, 0.25, depth);
        guard.addChild(brick);
      }
    }
    guard.addComponent("collision", {
      type: "box", halfExtents: new pc.Vec3(width / 2, height / 2, depth / 2),
    });
    guard.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
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
          this.#solids.push(Bookshelf.addVisual(models, this.#entity, {
            id: "castle-work-bookshelf", object: Bookshelf.name,
            from: { x, y, z: shelfBack - 0.4675 },
            to: { x, y, z: shelfBack + 0.4675 },
            height: 1.8, facing: -deskSide,
          }));
        }
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
        // Clip boundary panels instead of dropping a whole tile when only
        // its corner touches the stair opening. Match the support cut below.
        const pieces = subtractFloorArea([[x, x + w, z, z + d]], {
          minX: stair.x - radius, maxX: stair.x + radius,
          minZ: stair.z - radius, maxZ: stair.z + radius,
        });
        for (const [minX, maxX, minZ, maxZ] of pieces) {
          if (maxX <= minX || maxZ <= minZ) continue;
          const panel = place(floorUrl, "Bedroom oak parquet panel",
            (minX + maxX) / 2, y + 0.002, (minZ + maxZ) / 2);
          panel.setLocalScale(maxX - minX, 0.3, maxZ - minZ);
        }
      }
    }
    const rug = place(rugUrl, "Bedroom embroidered rug", (bedroom.minX + bedroom.maxX) / 2, y + 0.022, (bedroom.minZ + bedroom.maxZ) / 2, 0.55);
    rug.setLocalScale(0.7, 0.55, 0.55);
  }

  /**
   * Castle exterior buttresses, footings and chimneys.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   */
  #buildExterior(buildPlan, models, pc) {
    const { origin, yaw } = this.#layout;
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
    if (residential?.version === 2) {
      const keep = residential.placedRooms.find(/**
       *
       * @param {import("../../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
       */
      (room) => room.stairHost);
      if (keep) {
        const left = (keep.minX + keep.maxX) / 2 < 0;
        const crest = models.instantiate(crestUrl);
        crest.name = "Castle keep royal crest";
        crest.setLocalPosition(left ? keep.minX - 0.35 : keep.maxX + 0.35,
          keep.floorY - origin.y + residential.rise + 1, (keep.minZ + keep.maxZ) / 2);
        crest.setLocalEulerAngles(0, left ? -90 : 90, 0);
        crest.setLocalScale(0.8, 0.8, 0.8);
        this.#entity.addChild(crest);
      }
    }
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

/**
 * Lower the first turn to keep headroom beneath the solid exit-side landing.
 * Bake the same profile into private visual and collision meshes; leave column
 * masonry unchanged and retain the railing's authored height above each tread.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").Entity} graph
 * @param {{minZ:number,maxZ:number}} shaft
 * @param {number} radius
 * @param {boolean} landingProfile
 * @param {number} turns
 * @returns {import("playcanvas").Mesh[]}
 */
function reshapeSpiralModel(pc, graph, shaft, radius, landingProfile = true, turns = 1.5) {
  const meshes = [];
  const inverse = new pc.Mat4().copy(graph.getWorldTransform()).invert();
  const point = new pc.Vec3();
  for (const render of graph.findComponents("render")) {
    const name = render.entity.name;
    if (!/^(Stone tread|Handrail|Rail post|Rail tread connection)/.test(name)) continue;
    const suffix = name.match(/(?:\.| )(\d+)$/);
    const step = Number(suffix?.[1] ?? 0) + 1;
    const base = step / 24;
    for (const instance of render.meshInstances) {
      const positions = [], indices = [], uvs = [];
      const source = instance.mesh;
      source.getPositions(positions); source.getIndices(indices); source.getUvs(0, uvs);
      const transform = new pc.Mat4().mul2(inverse, instance.node.getWorldTransform());
      for (let index = 0; index < positions.length; index += 3) {
        const terminalCap = name === "Handrail.021" && positions[index + 1] > 0;
        point.set(positions[index], positions[index + 1], positions[index + 2]);
        transform.transformPoint(point, point);
        // Stretch the last retained rail into the rear masonry, on both meshes.
        if (terminalCap && landingProfile) point.z -= (shaft.maxZ - shaft.minZ) / 2 * 0.65 / radius - 0.62 / Math.SQRT2;
        // Handrails follow the varying slope; posts and flat treads translate.
        const progress = name.startsWith("Handrail") ? Math.max(0, Math.min(1, point.y - 0.22)) : base;
        const rawAngle = Math.atan2(point.x, point.z);
        const angle = (rawAngle + Math.round((progress * Math.PI * 3 - rawAngle) / (Math.PI * 2)) * Math.PI * 2) * turns / 1.5;
        const distance = Math.hypot(point.x, point.z);
        positions[index] = turns === 1.5 ? point.x : Math.sin(angle) * distance;
        positions[index + 1] = point.y + spiralStairRise(progress, landingProfile) - progress;
        positions[index + 2] = turns === 1.5 ? point.z : Math.cos(angle) * distance;
      }
      const mesh = new pc.Mesh(source.device);
      mesh.setPositions(positions); mesh.setIndices(indices);
      mesh.setNormals(pc.calculateNormals(positions, indices));
      meshes.push(mesh);
      if (uvs.length) mesh.setUvs(0, uvs);
      mesh.update(pc.PRIMITIVE_TRIANGLES);
      instance.mesh = mesh;
    }
    render.entity.setLocalPosition(0, 0, 0);
    render.entity.setLocalEulerAngles(0, 0, 0);
    render.entity.setLocalScale(1, 1, 1);
  }
  return meshes;
}
