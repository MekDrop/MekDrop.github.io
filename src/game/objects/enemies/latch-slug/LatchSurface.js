import { LatchDoorFilm } from "./LatchDoorFilm.js";
import { LatchGelScrape } from "./LatchGelScrape.js";
import { LatchGelUnion } from "./LatchGelUnion.js";
import { LatchDoorSurface } from "./LatchDoorSurface.js";
import { LatchFootprint } from "./LatchFootprint.js";
import { bodyToGel, gelVolume, impactTriangles } from "./LatchImpactShape.js";

const DEPOSIT_VOLUME_FRACTION = 0.35;

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
    // Outside the leaf, only wet real neighbouring masonry. A short native
    // ray accepts the arch/wall but cannot invent support across open air.
    this.field.support = this.#masonrySupport.bind(this);
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
    this.sourceVolume = Math.abs(gelVolume(this.start, this.indices))*DEPOSIT_VOLUME_FRACTION;
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
    this.scrape = new LatchGelScrape(initial.length / 3);
    this.splash.age = 0;
    this.age = 0;
    this.drained = false;
    this.entity.enabled = false;
    this.mesh.clear(true, false);
    this.mesh.setIndices(this.indices);
    this.update(0);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number|null}
   */
  #masonrySupport(x,y) {
    const { pc } = this.owner;
    const world = this.splash.entity.getWorldTransform();
    const start = world.transformPoint(new pc.Vec3(x,y,0.9*this.normalSign));
    const end = world.transformPoint(new pc.Vec3(x,y,-0.3*this.normalSign));
    const hits = this.owner.app.systems?.rigidbody?.raycastAll?.(start,end) ?? [];
    let nearest = null, distance = Infinity;
    for (const hit of hits) {
      if (hit.entity.rigidbody?.type === "dynamic" || !hit.point) {
        continue;
      }
      const d = hit.point.distance(start);
      if (d < distance) {
        nearest = hit.point;
        distance = d;
      }
    }

    return nearest ? this.inverse.transformPoint(nearest).z*this.normalSign+0.003 : null;
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (!this.original) {
      return;
    }
    if (this.film) {
      this.age += dt;
      this.film.flowSpeed = this.#authoredOozeSpeed();
      this.film.update(dt);
      this.#showFilm();

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
    const thickness = Math.abs(raw - zero) > 1e-9 ? this.initialVolume / Math.abs(raw - zero) : 1;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] = this.base[i] + (this.positions[i] - this.base[i]) * thickness;
    }
    const conservedVolume = Math.abs(gelVolume(this.positions, this.indices) - gelVolume(this.base, this.indices));
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
    this.scrape?.flow(this.positions, this.base, dt);
    this.scrape?.apply(this.positions, this.base);
    // Floor projection may change the tessellated surface's signed volume.
    // Keep only the remaining mass, never refill it from the original splat.
    const clipped = gelVolume(this.positions, this.indices);
    const clippedBase = gelVolume(this.base, this.indices);
    // Redistribution changes sampled thickness, never the amount left to eat.
    const redistributing = this.scrape?.changed && dt > 0 && highest > floor + 0.1;
    const retained = redistributing ? remainingVolume : Math.min(Math.abs(clipped - clippedBase), remainingVolume);
    const retainedThickness = Math.abs(clipped - clippedBase) > 1e-9 ? retained / Math.abs(clipped - clippedBase) : 1;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] = this.base[i] + (this.positions[i] - this.base[i]) * retainedThickness;
    }
    if (this.scrape?.changed) {
      const beforeRipple = Math.abs(gelVolume(this.positions, this.indices) - gelVolume(this.base, this.indices));
      const previousPositions = this.positions.slice(), previousBase = this.base.slice();
      this.scrape.relax(this.positions, this.base, this.indices);
      for (let i = 0; i < this.positions.length; i += 3) {
        const support = this.field.height(this.positions[i], this.positions[i + 1]);
        this.positions[i + 2] += support - this.base[i + 2];
        this.base[i + 2] = support;
      }
      const rippled = gelVolume(this.positions, this.indices), relaxedBase = gelVolume(this.base, this.indices);
      // Film volume excludes the supporting door. Never invert its thickness
      // when support geometry or reflow changes signed mesh orientation.
      const fluid = Math.abs(rippled - relaxedBase);
      const valid = fluid > 1e-9 && Number.isFinite(fluid);
      if (!valid) {
        this.positions.set(previousPositions);
        this.base.set(previousBase);
      }
      const correction = valid ? beforeRipple / fluid : 1;
      for (let i = 2; i < this.positions.length; i += 3) {
        this.positions[i] = this.base[i] + (this.positions[i] - this.base[i]) * correction;
      }
    }
    const volume = Math.abs(gelVolume(this.positions, this.indices) - gelVolume(this.base, this.indices));
    this.sourceVolume = volume;
    if (this.scrape?.changed && volume <= Math.max(1e-7, this.initialVolume * 0.002)) {
      this.drained = true;
    }
    this.metrics.frames++;
    this.metrics.transition = progress;
    this.metrics.volume = volume;
    this.metrics.sourceVolume = this.sourceVolume;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] *= this.normalSign;
    }
    if (this.age >= 0.38 && this.filmEnabled !== false) {
      const unsigned = this.positions.slice();
      for (let i = 2; i < unsigned.length; i += 3) {
        unsigned[i] *= this.normalSign;
      }
      this.film = new LatchDoorFilm({
        positions: unsigned,
        indices: this.indices,
        field: this.field,
        floor: this.floor,
        volume: this.sourceVolume,
      });
      this.#showFilm();

      return;
    }
    this.renderIndices = this.indices;
    if (this.scrape?.changed) {
      this.renderIndices = [];
      for (let i = 0; i < this.indices.length; i += 3) {
        const a = this.indices[i], b = this.indices[i + 1], c = this.indices[i + 2];
        let visible = false;
        for (const index of [a, b, c]) {
          visible ||= this.positions[index * 3 + 2] * this.normalSign - this.base[index * 3 + 2] > 0.0002;
        }
        if (visible) {
          this.renderIndices.push(a, b, c);
        }
      }
      this.mesh.setIndices(this.renderIndices);
    }
    this.mesh.setPositions(this.positions);
    this.#footprint = null;
    const normals = pc.calculateNormals(this.positions, this.renderIndices);
    this.scrape?.smoothNormals(normals);
    this.mesh.setNormals(normals);
    this.mesh.update();
    // One frame shows the untouched skinned body, then the resampled same pose
    // takes over and deforms continuously. No relocation to the contact plane.
    if (this.age >= 1 / 60) {
      this.owner.finishSplatTransition();
      this.entity.enabled = true;
    }
  }

  /**
   * Keep the original authored drip timing while the local film handles bites
   * and support. Animation controls the pace, never adds gel or expands width.
   * @returns {number}
   */
  #authoredOozeSpeed() {
    const choice = this.splash.variation;
    const samples = choice?.profile.depthBySecond;
    if (!samples?.length) {
      return 0.015;
    }
    const speed = choice.speed ?? 1, time = this.age*speed;
    for (let i=1;i<samples.length;i++) {
      if (time <= samples[i][0]) {
        const [before,after] = [samples[i-1],samples[i]];

        return Math.max(0,(after[1]-before[1])/(after[0]-before[0]))*(choice.height ?? 1)*speed;
      }
    }

    return 0.004;
  }

  #showFilm() {
    const { pc } = this.owner;
    this.positions = this.film.renderPositions.slice();
    this.base = this.film.base;
    this.indices = this.film.indices;
    this.renderIndices = this.film.renderIndices.slice();
    if (this.normalSign < 0) {
      for (let i = 0; i < this.renderIndices.length; i += 3) {
        [this.renderIndices[i + 1], this.renderIndices[i + 2]] = [this.renderIndices[i + 2], this.renderIndices[i + 1]];
      }
    }
    this.sourceVolume = this.film.volume;
    this.drained = this.film.drained;
    this.metrics.sourceVolume = this.sourceVolume;
    this.metrics.volume = this.sourceVolume;
    this.metrics.frames++;
    for (let i = 2; i < this.positions.length; i += 3) {
      this.positions[i] *= this.normalSign;
    }
    this.mesh.setPositions(this.positions);
    this.mesh.setIndices(this.renderIndices);
    this.mesh.setNormals(pc.calculateNormals(this.positions,this.renderIndices));
    this.mesh.update();
    this.#footprint = null;
    this.owner.finishSplatTransition();
    this.entity.enabled = true;
  }

  /**
   * @returns {boolean}
   */
  get hasScrapes() {
    return this.film?.changed ?? this.scrape?.changed ?? false;
  }

  /**
   * Bottom-up front-skin points, preferring thickness within each reach band.
   * @param {import("playcanvas").Vec3} origin
   * @param {number} maxReach
   * @returns {(import("playcanvas").Vec3 & {gooThickness:number})[]}
   */
  scrapeCandidates(origin, maxReach) {
    if (!this.positions || this.drained || this.age < 0.38) {
      return [];
    }
    const transform = this.splash.entity.getWorldTransform();
    const localOrigin = transform.clone().invert().transformPoint(origin);
    if (this.field && localOrigin.z * this.normalSign < this.field.height(localOrigin.x, localOrigin.y) - 0.025) {
      return [];
    }
    const { pc } = this.owner;
    const candidates = [];
    for (let i = 0; i < this.positions.length; i += 3) {
      if (this.positions[i + 2] * this.normalSign - this.base[i + 2] < 0.004) {
        continue;
      }
      const point = transform.transformPoint(new pc.Vec3(this.positions[i], this.positions[i + 1], this.positions[i + 2]));
      if (point.distance(origin) <= maxReach) {
        candidates.push(Object.assign(point, { gooThickness: this.positions[i + 2] * this.normalSign - this.base[i + 2] }));
      }
    }
    candidates.sort(LatchSurface.#thickestFirst);

    return candidates;
  }

  /**
   * @param {import("playcanvas").Vec3 & {gooThickness:number}} a
   * @param {import("playcanvas").Vec3 & {gooThickness:number}} b
   * @returns {number}
   */
  static #thickestFirst(a, b) {
    return Math.floor(a.y/0.08)-Math.floor(b.y/0.08) || b.gooThickness - a.gooThickness || a.y-b.y;
  }

  /**
   * Remove thickness only under the contacted stroke, retaining all other gel.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {number} radius
   * @param {(data: { positions: number[], material: import("playcanvas").StandardMaterial, volume: number }) => void} [onCollect]
   * @returns {number}
   */
  scrapeAt(start, end, radius, onCollect) {
    if (!this.scrape || this.drained || !Number.isFinite(radius) || radius <= 0) {
      return 0;
    }
    const transform = this.splash.entity.getWorldTransform();
    const inverse = transform.clone().invert();
    if (this.film) {
      const beforePositions = this.positions.slice();
      const from = inverse.transformPoint(start), to = inverse.transformPoint(end);
      from.z *= this.normalSign; to.z *= this.normalSign;
      const removed = this.film.cut(from, to, radius);
      if (removed > 1e-7 && onCollect) {
        const selected = [], point = new this.owner.pc.Vec3();
        for (let i = 0; i < this.film.frontIndices.length; i += 3) {
          const triangle = this.film.frontIndices.slice(i,i+3);
          let touched = false;
          for (const index of triangle) {
            touched ||= this.film.lastRemoved[index] > 0;
          }
          if (!touched) {
            continue;
          }
          for (const index of triangle) {
            transform.transformPoint(point.set(beforePositions[index*3],beforePositions[index*3+1],beforePositions[index*3+2]),point);
            selected.push(point.x,point.y,point.z);
          }
        }
        onCollect({
          positions:selected,
          material:this.material,
          volume:removed,
        });
      }
      this.#showFilm();
      this.#union?.invalidate();

      return removed;
    }
    const previous = this.scrape.remaining.slice();
    const beforePositions = this.positions.slice();
    if (!this.scrape.cut(this.positions, inverse.transformPoint(start), inverse.transformPoint(end), radius)) {
      return 0;
    }
    const before = this.sourceVolume;
    this.update(0);
    this.#union?.invalidate();
    const removed = Math.max(0, before - this.sourceVolume);
    if (removed > 1e-7 && onCollect) {
      onCollect({
        positions: this.#removedSkin(beforePositions, previous, transform),
        material: this.material,
        volume: removed,
      });
    }

    return removed;
  }

  /**
   * @param {Float32Array} positions
   * @param {Float32Array} previous
   * @param {import("playcanvas").Mat4} transform
   * @returns {number[]}
   */
  #removedSkin(positions, previous, transform) {
    const selected = [];
    const point = new this.owner.pc.Vec3();
    for (let i = 0; i < this.indices.length; i += 3) {
      const a = this.indices[i], b = this.indices[i + 1], c = this.indices[i + 2];
      if (previous[a] === this.scrape.remaining[a] && previous[b] === this.scrape.remaining[b] && previous[c] === this.scrape.remaining[c]) {
        continue;
      }
      for (const index of [a, b, c]) {
        transform.transformPoint(point.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]), point);
        selected.push(point.x, point.y, point.z);
      }
    }

    return selected;
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
      this.#footprint = new LatchFootprint(projected, this.renderIndices ?? this.indices);
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
