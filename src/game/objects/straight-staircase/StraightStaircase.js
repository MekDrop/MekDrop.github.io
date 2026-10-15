import { BUFFER_STATIC } from "playcanvas";
import { DynamicRenderBatch } from "../../rendering/DynamicRenderBatch.js";
import stairModuleUrl from "../../models/castle/stairs/castle-stair-module.glb?url";
import masonryBlockUrl from "../../models/castle/residential/masonry-block.glb?url";
import stoneUrl from "../../models/castle/residential/stone-block.glb?url";
import { castleStraightStairSurfaces, castleStraightStairTreads, castleStraightStairSurfaceHeight, castleStraightStairWalls, castleStraightStairBlocksCamera } from "../castle/CastleStraightStairs.js";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { CastleMasonryMaterial } from "../castle/CastleMasonryMaterial.js";
import { CASTLE_MATERIAL_DEFINITIONS } from "../../generator/castle/CastleGenerationConfig.js";
import { colorFromHex } from "../../helpers/colors.js";

/**
 * Registered two-flight stair assembly. Its local frame owns visuals and Ammo bodies.
 */
export class StraightStaircase {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [stairModuleUrl, masonryBlockUrl, stoneUrl]; }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @type {Map<string,import("playcanvas").StandardMaterial>}
   */
  #stairMaterials = new Map();
  /**
   * @type {import("playcanvas").GraphNode[]}
   */
  #stairPhysicsGraphs = [];
  /**
   * @type {import("playcanvas").MeshInstance[]}
   */
  #stairSupportInstances = [];
  /**
   * @type {import("playcanvas").Mat4}
   */
  #worldToCastle;
  /**
   * @type {{off:()=>void}}
   */
  #update;
  /**
   * @type {DynamicRenderBatch|null}
   */
  #renderBatch = null;

  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,modelLibrary:import("../../models/GameModelLibrary.js").GameModelLibrary,definition:import("../ObjectTypes.js").MapObjectDefinition,runtime:import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({pc, app, modelLibrary, definition, runtime = {}}) {
    this.#app = app;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} straight staircase`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const {x,y,z} = definition.position;
    this.#visual.setLocalPosition(x,y,z);
    this.#visual.setLocalEulerAngles(0, definition.rotation ?? 0, 0);
    // Preserve castle-space masonry projection, including island displacement.
    const frame = new pc.Entity("Stair masonry frame");
    this.#islandRoots.addChild(frame, definition.tile);
    this.#worldToCastle = new pc.Mat4();
    const update = () => this.#worldToCastle.copy(frame.getWorldTransform()).invert();
    update();
    this.#update = app.on("update", update);
    for (const name of ["castleStoneDark", "castleStoneMid"]) {
      const palette = CASTLE_MATERIAL_DEFINITIONS[name];
      const material = new pc.StandardMaterial();
      material.name = name;
      material.diffuse = colorFromHex(pc, palette.color);
      material.gloss = palette.gloss;
      material.metalness = 0;
      material.useMetalness = true;
      material.diffuseVertexColor = false;
      material.diffuseMap = runtime.textureAssets?.get("castleStone")?.resource ?? null;
      CastleMasonryMaterial.configure(pc, material, this.#worldToCastle.data);
      material.cull = pc.CULLFACE_BACK;
      material.update();
      this.#stairMaterials.set(name, material);
    }
    this.#build(pc, modelLibrary, definition);
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() { return [this.#visual]; }
  /**
   * @returns {boolean}
   */
  get isGroundCollider() { return true; }
  /**
   * @returns {boolean}
   */
  get physicsSurface() { return false; }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near,far]) {
    this.#islandRoots.setOffsets(near,far,offsets);
    for (const body of this.#visual.findComponents("rigidbody")) { body.syncEntityToBody(); }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} maximumHeight
   * @returns {number|null}
   */
  surfaceHeightAt(x,z,radius=0,maximumHeight=Infinity) {
    const point = this.#visual.getWorldTransform().clone().invert().transformPoint({
      x,
      y:0,
      z,
    });
    const base = this.#visual.getPosition().y;
    let height = null;
    for (const surface of castleStraightStairSurfaces(this.#definition)) {
      if (point.x < surface.minX || point.x > surface.maxX || point.z < surface.minZ || point.z > surface.maxZ) { continue; }
      const top = base + castleStraightStairSurfaceHeight(surface, point.z);
      if (top <= maximumHeight+1e-6) { height = height === null ? top : Math.max(height,top); }
    }

    return height;
  }

  /**
   * Preserve the former divider-only camera obstruction.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   * @returns {boolean}
   */
  blocksCameraAt(x,y,z,radius=0) {
    const center = this.#visual.getPosition();

    return castleStraightStairBlocksCamera({
      ...this.#definition,
      center,
      yaw:this.#definition.rotation ?? 0,
    },x,y,z,radius);
  }

  onSceneReady() {
    // Preserve the batching previously supplied by the owning castle.
    this.#renderBatch ??= new DynamicRenderBatch(this.#app, this.#visual, BUFFER_STATIC);
  }

  destroy() {
    this.#renderBatch?.destroy();
    this.#renderBatch = null;
    this.#update?.off();
    this.#entity.destroy();
    for (const graph of this.#stairPhysicsGraphs) { graph.destroy(); }
    for (const instance of this.#stairSupportInstances) { instance.destroy(); }
    for (const material of this.#stairMaterials.values()) { material.destroy(); }
    this.#stairPhysicsGraphs = [];
    this.#stairSupportInstances = [];
    this.#stairMaterials.clear();
  }

  /**
   * Stone modules and flat Ammo tread tops share the same step dimensions.
   * The hero can climb using its automatic step lift and rest on each tread.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {{center:{x:number,y:number,z:number},yaw:number,radius:number,rise:number,flightGap?:number}} stair
   */
  #build(pc, models, stair) {
    const root = this.#visual;
    root.tags.add("capsule-support");

    const positions = [], indices = [];
    for (const surface of castleStraightStairSurfaces(stair)) {
      const treads = castleStraightStairTreads(surface);
      const run = surface.maxZ - surface.minZ;
      const rise = surface.high - surface.low;
      // Turning landings use the castle's quarter-metre masonry courses.
      const steps = treads.length;
      // The generated upper landing owns the flat exit's visible surface.
      // Retain its flat collision support without drawing another tread layer.
      const drawSurface = rise > 0 || surface.high < stair.rise || !stair.exitFloorOwned;
      // Turning landings meet authored shaft masonry on the same vertical plane.
      // Recess only their visible perimeter; the full surface still owns support.
      const edgeClearance = rise > 0 ? 0 : 0.004;
      const visualRun = run - edgeClearance * 2;
      for (let step = 0; drawSurface && step < steps; step++) {
        const columns = Math.max(1, Math.round((surface.maxX - surface.minX) / 0.25));
        const width = (surface.maxX - surface.minX - edgeClearance * 2) / columns;
        const height = treads[step].height;
        const thickness = rise ? rise / steps : 0.25;
        const z = surface.reverse ? surface.maxZ - edgeClearance - visualRun * (step + 0.5) / steps : surface.minZ + edgeClearance + visualRun * (step + 0.5) / steps;
        // Use the original authored stone tread, including its riser and underside.
        for (let column = 0; column < columns; column++) {
          // Preserve the GLB root pivot: the masonry block starts at Y=0,
          // while the stair module is centred on Y=0.
          const tread = new pc.Entity();
          tread.addChild(models.instantiate(rise ? stairModuleUrl : masonryBlockUrl));
          tread.name = rise ? "Castle straight stone tread" : "Castle stair turning landing";
          tread.setLocalPosition(surface.minX + edgeClearance + width * (column + 0.5), height - (rise ? thickness / 2 : thickness), z);
          // Slightly overlap the original beveled modules so their seams cannot expose the room above.
          tread.setLocalScale(width + (rise ? 0.004 : 0), thickness + (rise ? 0.008 : 0),
            visualRun / steps / (rise ? 2 : 1) + (rise ? 0.008 : 0));
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
      for (const {front,rear,height,bottom} of treads) {
        const offset = positions.length / 3;
        positions.push(surface.minX, height, front, surface.minX, height, rear,
          surface.maxX, height, rear, surface.maxX, height, front);
        indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        if (rise > 0) {
          const edge = surface.reverse ? rear : front;
          const wall = positions.length / 3;
          positions.push(surface.minX, bottom, edge, surface.minX, height, edge,
            surface.maxX, height, edge, surface.maxX, bottom, edge);
          indices.push(wall, wall + 1, wall + 2, wall, wall + 2, wall + 3,
            wall + 2, wall + 1, wall, wall + 3, wall + 2, wall);
        }
      }
    }
    const mesh = new pc.Mesh(this.#app.graphicsDevice);
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
    root.addComponent("collision", {
      type: "mesh",
      model,
    });
    root.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
      restitution: 0,
    });
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
    const wall = castleStraightStairWalls(stair)[0];
    const length = wall.depth;
    if (length <= 0) { return; }
    const nextFlight = stair.continuesAbove;
    // Lower segments meet at floor height; the final segment ends at
    // the same 75 cm guard height as the top-floor half wall.
    const height = wall.height;
    const divider = new pc.Entity("Castle stair brick divider");
    divider.setLocalPosition(wall.x, wall.y, wall.z);
    root.addChild(divider);
    const courses = Math.max(1, Math.ceil(height / 0.25));
    const courseHeight = height / courses;
    const columns = Math.max(1, Math.ceil(length / 0.25));
    const brickLength = length / columns;
    for (let row = 0; row < courses; row++) {
      for (let column = 0; column < columns; column++) {
        const shade = (row + column * 3) % 8;
        const material = this.#stairMaterials.get(shade === 0 || shade === 7 ? "castleStoneDark" : "castleStoneMid");
        const brick = models.instantiateMerged(masonryBlockUrl, {
          material,
          linearVertexColors: true,
        });
        brick.setLocalPosition(0, -height / 2 + row * courseHeight,
          -length / 2 + (column + 0.5) * brickLength);
        brick.setLocalScale(0.25, courseHeight, brickLength);
        divider.addChild(brick);
      }
    }
    divider.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(0.125, height / 2, length / 2),
    });
    divider.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
      restitution: 0,
    });
    if (!nextFlight) { this.#buildStairOpeningGuard(pc, models, root, stair); }
  }

  /**
   * A plain terrace-height guard closes the upper floor's drop beside the
   * divider. Intermediate floors stay open for the next ascending flight.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} root
   * @param {{radius:number,rise:number}} stair
   */
  #buildStairOpeningGuard(pc, models, root, stair) {
    const {x,y,z,width,height,depth} = castleStraightStairWalls(stair)[1];
    const guard = new pc.Entity("Castle stair opening half wall");
    guard.setLocalPosition(x,y,z);
    root.addChild(guard);
    const columns = Math.max(1, Math.ceil(width / 0.5));
    const brickWidth = width / columns;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < columns; column++) {
        const brick = models.instantiateMerged(stoneUrl, {
          material: this.#stairMaterials.get("castleStoneMid"),
          linearVertexColors: true,
        });
        brick.setLocalPosition(-width / 2 + brickWidth * (column + 0.5), -height / 2 + row * 0.25, 0);
        brick.setLocalScale(brickWidth, 0.25, depth);
        guard.addChild(brick);
      }
    }
    guard.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(width / 2, height / 2, depth / 2),
    });
    guard.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
      restitution: 0,
    });
  }

}
