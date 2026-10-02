import treadUrl from "../../models/spiral-staircase/spiral-tread.glb?url";
import columnUrl from "../../models/spiral-staircase/castle-brick.glb?url";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { SpiralStaircaseLayout } from "./SpiralStaircaseLayout.js";
import { CASTLE_BLOCK_SIZE } from "../../generator/castle/CastleGenerationConfig.js";

// Measured upper edge of the authored handrail above its tread surface.
const HANDRAIL_TOP_HEIGHT = 1.02117312;

/**
 * Map-authored modular stone staircase. Ammo owns tread support at each level,
 * including overlapping turns, so an upper turn cannot capture a hero below it.
 */
export class SpiralStaircase {
  /**
   * @returns {Array<string>}
   */
  static get modelUrls() { return [treadUrl, columnUrl]; }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {Array<import("playcanvas").Entity>}
   */
  #collisionGraphs = [];
  /**
   * @type {import("playcanvas").VertexBuffer|null}
   */
  #columnBuffers = [];
  /**
   * @type {Array<import("playcanvas").StandardMaterial>}
   */
  #columnMaterials = [];

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime: import("../ObjectTypes.js").MapObjectRuntime}} options
   * @param {import("playcanvas").Application} options.app
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("../ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("../ObjectTypes.js").MapObjectRuntime} options.runtime
   */
  constructor({ pc, app, modelLibrary, definition, runtime = {} }) {
    SpiralStaircaseLayout.steps(definition);
    this.#app = app;
    this.#pc = pc;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} spiral staircase`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const { x, z } = definition.position;
    this.#visual.setLocalPosition(x, 0, z);
    for (const step of SpiralStaircaseLayout.steps(definition)) {
      const root = new pc.Entity(`${definition.id} tread ${step.height}`);
      root.setLocalPosition(0, step.height, 0);
      root.setLocalEulerAngles(0, step.rotation, 0);
      root.addChild(modelLibrary.instantiate(treadUrl));
      this.#visual.addChild(root);
      const graph = modelLibrary.instantiateMerged(treadUrl);
      const model = new pc.Model();
      model.graph = graph;
      model.meshInstances = graph.findComponents("render").flatMap(
        /**
         * @param {import("playcanvas").RenderComponent} render
         */
        (render) => render.meshInstances);
      root.addComponent("collision", { type: "mesh", model });
      root.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
      this.#collisionGraphs.push(graph);
    }
    const height = definition.Z2 - definition.Z1 + HANDRAIL_TOP_HEIGHT;
    const column = new pc.Entity(`${definition.id} center column`);
    column.setLocalPosition(0, definition.Z1 + height / 2, 0);
    // Use the castle's authored masonry at its native block dimensions.
    const width = CASTLE_BLOCK_SIZE * 2;
    // The castle wall module contains three actual brick faces per block width
    // and four courses per block height. Use those dimensions for individual stones.
    const brickWidth = CASTLE_BLOCK_SIZE / 3;
    const courseHeight = CASTLE_BLOCK_SIZE / 4;
    const courses = Math.ceil(height / courseHeight);
    const batches = [[], [], []];
    for (let course = 0; course < courses; course += 1) {
      const brickHeight = Math.min(courseHeight, height - course * courseHeight);
      for (let x = 0; x < 6; x += 1) {
        for (let z = 0; z < 6; z += 1) {
          const matrix = new pc.Mat4();
          matrix.setTRS(
            new pc.Vec3(
              -width / 2 + (x + 0.5) * brickWidth,
              -height / 2 + course * courseHeight,
              -width / 2 + (z + 0.5) * brickWidth,
            ),
            pc.Quat.IDENTITY,
            new pc.Vec3(brickWidth, brickHeight, brickWidth),
          );
          batches[(x + z * 2 + course * 7) % 3].push(...matrix.data);
        }
      }
    }
    // The same linear glTF palette used by the gateway's masonry tiles.
    const palette = [0x090d0f, 0x111719, 0x1b2326];
    for (let index = 0; index < batches.length; index += 1) {
      const color = palette[index];
      const material = new pc.StandardMaterial();
      material.diffuse = new pc.Color(
        ((color >> 16) & 255) / 255,
        ((color >> 8) & 255) / 255,
        (color & 255) / 255,
      ).gamma();
      material.gloss = 0.08;
      material.useMetalness = true;
      material.metalness = 0;
      material.update();
      this.#columnMaterials.push(material);
      const batch = modelLibrary.instantiateMergedBatch(columnUrl, batches[index], {
        name: "Gateway palette column bricks", material,
      });
      column.addChild(batch.entity);
      this.#columnBuffers.push(batch.vertexBuffer);
    }
    this.#visual.addChild(column);
    column.addComponent("collision", {
      type: "box", halfExtents: new pc.Vec3(width / 2, height / 2, width / 2),
    });
    column.addComponent("rigidbody", { type: "static", friction: 0.6 });
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {Array<import("playcanvas").Entity>}
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
   */
  setIslandOffsets(near, far) { this.#islandRoots.setOffsets(near, far); }

  /**
   * Uses Ammo to select the tread below a height limit across stacked turns.
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} maximumHeight
   * @returns {number|null}
   */
  surfaceHeightAt(x, z, radius = 0, maximumHeight = Infinity) {
    const origin = this.#visual.getPosition();
    if (Math.hypot(x - origin.x, z - origin.z) > 1.8 + radius) { return null; }
    const top = Math.min(maximumHeight, this.#definition.Z2 + origin.y + HANDRAIL_TOP_HEIGHT);
    const from = new this.#pc.Vec3(x, top + 0.001, z);
    const to = new this.#pc.Vec3(x, this.#definition.Z1 + origin.y - 0.2, z);
    if (from.y <= to.y) { return null; }
    let height = null;
    for (const hit of this.#app.systems.rigidbody.raycastAll(from, to)) {
      let entity = hit.entity;
      while (entity && entity !== this.#visual) { entity = entity.parent; }
      if (entity !== this.#visual || hit.normal.y < 0.5 || hit.point.y > top) { continue; }
      height = height === null ? hit.point.y : Math.max(height, hit.point.y);
    }
    return height;
  }

  destroy() {
    this.#entity.destroy();
    for (const buffer of this.#columnBuffers) buffer.destroy();
    this.#columnBuffers = [];
    for (const material of this.#columnMaterials) material.destroy();
    this.#columnMaterials = [];
    for (const graph of this.#collisionGraphs) { graph.destroy(); }
    this.#collisionGraphs = [];
  }
}
