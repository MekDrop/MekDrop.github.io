import { LatchCoverage } from "./LatchCoverage.js";

/**
 * One door-bound render surface, independent of any constituent slime's life.
 */
export class LatchGelUnion {
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;
  /**
   * @type {import("playcanvas").Entity}
   */
  #frame;
  /**
   * @type {number}
   */
  #normalSign;
  /**
   * @type {import("playcanvas").Mesh}
   */
  #mesh;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #material;
  /**
   * @type {import("playcanvas").MeshInstance}
   */
  #instance;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #handle;
  /**
   * @type {{preparationMs:number,patches:number,volume:number}|null}
   */
  metrics = null;

  /**
   * @type {Set<import("./LatchSurface.js").LatchSurface>}
   */
  members = new Set();
  /**
   * @type {boolean}
   */
  active = true;
  /**
   * @type {number}
   */
  #nextUpdate = 0;

  /**
   * @param {import("./LatchSurface.js").LatchSurface} surface
   */
  constructor(surface) {
    this.#owner = surface.owner;
    this.#frame = surface.frame;
    this.#normalSign = surface.normalSign;
    const { pc, app } = this.#owner;
    this.entity = new pc.Entity("Area-merged door gel");
    app.root.addChild(this.entity);
    this.#mesh = new pc.Mesh(app.graphicsDevice);
    this.#material = surface.material.clone();
    this.#instance = new pc.MeshInstance(this.#mesh, this.#material, this.entity);
    this.#instance.castShadow = false;
    this.#instance.cull = false;
    this.entity.addComponent("render", { meshInstances: [this.#instance] });
    this.#handle = app.on("prerender", this.update, this);
    this.add(surface);
  }

  /**
   * @param {import("./LatchSurface.js").LatchSurface} surface
   */
  add(surface) {
    this.members.add(surface);
    surface.instance.visible = false;
    this.#nextUpdate = 0;
  }

  /**
   * @param {import("./LatchSurface.js").LatchSurface} surface
   */
  remove(surface) {
    this.members.delete(surface);
    surface.instance.visible = true;
    this.#nextUpdate = 0;
    if (this.members.size === 0) {
      this.destroy();
    }
  }

  invalidate() {
    this.#nextUpdate = 0;
  }

  update() {
    if (!this.active) {
      return;
    }
    this.entity.setPosition(this.#frame.getPosition());
    this.entity.setRotation(this.#frame.getRotation());
    const now = performance.now();
    if (now < this.#nextUpdate) {
      return;
    }
    this.#nextUpdate = now + 1000 / 15;
    const { pc } = this.#owner;
    const inverse = this.entity.getWorldTransform().clone().invert();
    const point = new pc.Vec3();
    const patches = [];
    let scraped = false;
    for (const surface of this.members) {
      scraped ||= surface.hasScrapes;
      const transform = new pc.Mat4().mul2(inverse, surface.splash.entity.getWorldTransform());
      const positions = new Float32Array(surface.positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        transform.transformPoint(point.set(surface.positions[i], surface.positions[i + 1], surface.positions[i + 2]), point);
        positions.set([point.x, point.y, point.z * this.#normalSign], i);
      }
      patches.push({
        positions,
        indices: surface.renderIndices ?? surface.indices,
        volume: surface.sourceVolume,
      });
    }
    const started = performance.now();
    const reference = this.members.values().next().value;
    let support = null;
    if (reference?.field) {
      const local = new pc.Mat4().mul2(reference.splash.entity.getWorldTransform().clone().invert(), this.entity.getWorldTransform());
      const world = local.clone().invert();
      const sample = new pc.Vec3();
      support = /**
       * @param {number} x
       * @param {number} y
       * @returns {number}
       */
        (x, y) => {
          local.transformPoint(sample.set(x, y, 0), sample);
          sample.z = reference.field.height(sample.x, sample.y) * this.#normalSign;
          world.transformPoint(sample, sample);

          return sample.z * this.#normalSign + 0.004;
        };
    }
    const coverage = new LatchCoverage(patches, !scraped, support);
    this.metrics = {
      preparationMs: performance.now() - started,
      patches: patches.length,
      volume: coverage.volume,
    };
    for (let i = 2; i < coverage.positions.length; i += 3) {
      coverage.positions[i] *= this.#normalSign;
    }
    if (this.#normalSign < 0) {
      for (let i = 0; i < coverage.indices.length; i += 3) {
        [coverage.indices[i + 1], coverage.indices[i + 2]] = [coverage.indices[i + 2], coverage.indices[i + 1]];
      }
    }
    this.#mesh.clear(true, false);
    this.#mesh.setPositions(coverage.positions);
    this.#mesh.setIndices(coverage.indices);
    this.#mesh.setNormals(pc.calculateNormals(coverage.positions, coverage.indices));
    this.#mesh.update();
  }

  destroy() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.#handle.off();
    for (const surface of this.members) {
      surface.instance.visible = true;
    }
    this.members.clear();
    this.entity.destroy();
    this.#mesh.destroy();
    this.#material.destroy();
  }
}
