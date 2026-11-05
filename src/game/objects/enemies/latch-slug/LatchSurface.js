import { LatchGelUnion } from "./LatchGelUnion.js";
import { LatchDoorSurface } from "./LatchDoorSurface.js";
import { LatchFootprint } from "./LatchFootprint.js";
import { bodyToGel, gelVolume, impactTriangles } from "./LatchImpactShape.js";

/**
 * Continuous visual deformation of authored geometry. Ammo still owns contact
 * and the launch. Its solver cannot simulate viscous free-surface wetting, so
 * this persistent presentation follows native morph animation over a
 * sampled door surface; it never integrates forces or alters door collision.
 */
export class LatchSurface {
  /**
   * @type {LatchFootprint|null}
   */
  #footprint = null;
  /**
   * @type {LatchGelUnion|null}
   */
  #union = null;

  /**
   * @type {boolean}
   */
  drained = false;
  /**
   * @param {import("./LatchSplash.js").LatchSplash} splash
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(splash, owner) {
    this.splash = splash;
    this.owner = owner;
    const { pc } = owner;
    this.entity = new pc.Entity("Continuous door-bound slug mass");
    splash.entity.addChild(this.entity);
    this.mesh = new pc.Mesh(owner.app.graphicsDevice);
    const original = splash.model.findComponents("render")[0].meshInstances[0];
    this.material = original.material.clone();
    const positions = [], indices = [];
    original.mesh.getPositions(positions);
    original.mesh.getIndices(indices);
    this.mesh.setPositions(positions);
    this.mesh.setIndices(indices);
    this.mesh.setNormals(pc.calculateNormals(positions, indices));
    this.mesh.update();
    this.instance = new pc.MeshInstance(this.mesh, this.material, this.entity);
    this.instance.castShadow = false;
    this.instance.cull = false;
    this.entity.addComponent("render", { meshInstances: [this.instance] });
    for (const render of splash.model.findComponents("render")) {
      for (const instance of render.meshInstances) {
        instance.visible = false;
      }
    }
    this.entity.enabled = true;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   * @param {number} side
   */
  bind(door, side) {
    const { pc } = this.owner;
    this.frame = door.entity;
    this.normalSign = side > 0 ? -1 : 1;
    this.inverse = this.splash.entity.getWorldTransform().clone().invert();
    this.floor = this.inverse.transformPoint(this.frame.getPosition()).y;
    this.field = new LatchDoorSurface();
    const point = new pc.Vec3();
    for (const instance of door.getSurfaceMeshInstances()) {
      const positions = [], indices = [], points = [];
      instance.mesh.getPositions(positions);
      instance.mesh.getIndices(indices);
      const transform = new pc.Mat4().mul2(this.inverse, instance.node.getWorldTransform());
      for (let i = 0; i < positions.length; i += 3) {
        transform.transformPoint(point.set(positions[i], positions[i + 1], positions[i + 2]), point);
        points.push([point.x, point.y, point.z * this.normalSign]);
      }
      for (let i = 0; i < indices.length; i += 3) {
        this.field.addTriangle(points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]);
      }
    }
    this.field.finish();
    this.field.baseline = -0.008;
    this.original = this.splash.model.findByName(this.splash.variation.profile.node).render.meshInstances[0];
    this.basis = [];
    this.indices = [];
    this.original.mesh.getPositions(this.basis);
    this.original.mesh.getIndices(this.indices);
    this.targets = this.original.mesh.morph.targets;
    this.transform = new pc.Mat4().mul2(this.inverse, this.original.node.getWorldTransform());
    const initial = new Float32Array(this.basis.length);
    for (let i = 0; i < this.basis.length; i += 3) {
      this.transform.transformPoint(point.set(this.basis[i], this.basis[i + 1], this.basis[i + 2]), point);
      initial.set([point.x, point.y, point.z * this.normalSign], i);
    }
    const triangles = impactTriangles(pc, this.owner.getImpactMeshes(), this.inverse);
    for (const triangle of triangles) {
      for (let i = 2; i < 9; i += 3) {
        triangle[i] *= this.normalSign;
      }
    }
    const started = performance.now();
    this.start = bodyToGel(initial, triangles);
    this.sourceVolume = Math.abs(gelVolume(this.start, this.indices));
    this.initialVolume = this.sourceVolume;
    this.metrics = {
      triangles: this.field.triangles,
      bodyTriangles: triangles.length,
      preparationMs: performance.now() - started,
      sourceVolume: this.sourceVolume,
      maxRelativeVolumeError: 0,
      frames: 0,
    };
    this.initial = initial;
    this.positions = new Float32Array(initial.length);
    this.base = new Float32Array(initial.length);
    this.splash.age = 0;
    this.age = 0;
    this.drained = false;
    this.entity.enabled = false;
    this.mesh.clear(true, false);
    this.mesh.setIndices(this.indices);
    this.update(0);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!this.original) {
      return;
    }
    const { pc } = this.owner;
    const remainingVolume = this.sourceVolume;
    this.sourceVolume = this.initialVolume;
    this.age += dt;
    const progress = Math.min(1, this.age / 0.38);
    const blend = progress * progress * (3 - 2 * progress);
    const point = new pc.Vec3();
    const weights = [];
    for (let target = 0; target < this.targets.length; target++) {
      weights[target] = target ? this.original.morphInstance.getWeight(target) : 0;
    }
    for (let i = 0; i < this.basis.length; i += 3) {
      let x = this.basis[i], y = this.basis[i + 1], z = this.basis[i + 2];
      for (let target = 0; target < this.targets.length; target++) {
        const delta = this.targets[target].deltaPositions;
        x += delta[i] * weights[target];
        y += delta[i + 1] * weights[target];
        z += delta[i + 2] * weights[target];
      }
      this.transform.transformPoint(point.set(x, y, z), point);
      const flowY = this.field.flow(point.x, this.initial[i + 1], point.y);
      let outX = this.start[i] * (1 - blend) + point.x * blend;
      let outY = this.start[i + 1] * (1 - blend) + flowY * blend;
      const surface = this.field.height(outX, outY) * blend;
      this.base.set([outX, outY, surface], i);
      this.positions.set([outX, outY, this.start[i + 2] * (1 - blend) + (point.z * this.normalSign + surface) * blend], i);
    }
    // A surface displacement is a shear. Compensate the extra area/compression
    // from routing around metal lips with thickness, including during impact.
    const raw = gelVolume(this.positions, this.indices), zero = gelVolume(this.base, this.indices);
    const wanted = Math.sign(raw) * this.initialVolume;
    const thickness = Math.abs(raw - zero) > 1e-9 ? (wanted - zero) / (raw - zero) : 1;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] = this.base[i] + (this.positions[i] - this.base[i]) * thickness;
    }
    const conservedVolume = Math.abs(gelVolume(this.positions, this.indices));
    this.metrics.maxRelativeVolumeError = Math.max(this.metrics.maxRelativeVolumeError, Math.abs(conservedVolume / this.initialVolume - 1));
    // Ammo has no viscous free-surface solver: the authored morph owns downward
    // travel. Clip only gel that has actually reached the door's floor plane;
    // never restore drained volume or hide a patch based on its age.
    const floor = this.floor;
    let highest = -Infinity;
    for (let i = 0; i < this.positions.length; i += 3) {
      highest = Math.max(highest, this.positions[i + 1]);
      if (this.positions[i + 1] <= floor) {
        this.positions[i + 1] = floor;
        this.base[i + 1] = floor;
        this.base[i + 2] = this.field.height(this.positions[i], floor);
      }
    }
    this.drained = highest <= floor + 0.0001;
    // Floor projection may change the tessellated surface's signed volume.
    // Keep only the remaining mass, never refill it from the original splat.
    const clipped = gelVolume(this.positions, this.indices);
    const clippedBase = gelVolume(this.base, this.indices);
    const retained = Math.sign(clipped) * Math.min(Math.abs(clipped), remainingVolume);
    const retainedThickness = Math.abs(clipped - clippedBase) > 1e-9 ? (retained - clippedBase) / (clipped - clippedBase) : 1;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] = this.base[i] + (this.positions[i] - this.base[i]) * retainedThickness;
    }
    const volume = Math.abs(gelVolume(this.positions, this.indices));
    this.sourceVolume = volume;
    this.metrics.frames++;
    this.metrics.transition = progress;
    this.metrics.volume = volume;
    this.metrics.sourceVolume = this.sourceVolume;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] *= this.normalSign;
    }
    this.mesh.setPositions(this.positions);
    this.#footprint = null;
    this.mesh.setNormals(pc.calculateNormals(this.positions, this.indices));
    this.mesh.update();
    // One frame shows the untouched skinned body, then the resampled same pose
    // takes over and deforms continuously. No relocation to the contact plane.
    if (this.age >= 1 / 60) {
      this.owner.finishSplatTransition();
      this.entity.enabled = true;
    }
  }

  /**
   * @returns {LatchFootprint}
   */
  get footprint() {
    if (!this.#footprint) {
      const entity = this.splash.entity;
      const transform = entity.getWorldTransform();
      const right = entity.right, up = entity.up;
      const point = new this.owner.pc.Vec3();
      const projected = [];
      for (let i = 0; i < this.positions.length; i += 3) {
        transform.transformPoint(point.set(this.positions[i], this.positions[i + 1], this.positions[i + 2]), point);
        projected.push(point.dot(right), point.dot(up));
      }
      this.#footprint = new LatchFootprint(projected, this.indices);
    }

    return this.#footprint;
  }

  /**
   * Binding only happens at door impact. The first visible wet frame can join;
   * waiting for the full flattening animation can miss a brief real contact.
   * @param {LatchSurface} other
   * @returns {boolean}
   */
  touches(other) {
    return this.age >= 1 / 60 && other.age >= 1 / 60 && this.footprint.touches(other.footprint);
  }

  /**
   * Join wet coverage without moving either patch into the other's footprint.
   * @param {LatchSurface} incoming
   */
  merge(incoming) {
    if (this.#union?.active && this.#union === incoming.#union) {
      return;
    }
    if (!this.#union?.active) {
      this.#union = new LatchGelUnion(this);
    }
    const previous = incoming.#union;
    const members = previous?.active ? [...previous.members] : [incoming];
    previous?.destroy();
    for (const surface of members) {
      this.#union.add(surface);
      surface.#union = this.#union;
    }
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get visibleEntity() {
    return this.#union?.active ? this.#union.entity : this.entity;
  }

  clear() {
    this.#union?.remove(this);
    this.#union = null;
    this.entity.enabled = false;
    if (this.original) {
      this.owner.finishSplatTransition();
    }
    this.original = null;
  }

  destroy() {
    this.#union?.remove(this);
    this.#union = null;
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
