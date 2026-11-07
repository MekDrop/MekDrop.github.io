import { impactTriangles } from "./LatchImpactShape.js";

const COLLAPSE_DURATION = 1.3;

/**
 * Collapse the actual posed skin onto Ammo's supporting floor. This is a
 * bounded gel presentation, not a replacement rigid/soft-body integrator.
 */
export class LatchFloorPuddle {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.age = 0;
    this.active = false;
    this.sounded = false;
    this.parts = [];
    const { pc, app } = owner;
    this.originals = owner.getImpactMeshes();
    this.source = this.originals.find(LatchFloorPuddle.#isBody);
    if (!this.source) {
      return;
    }
    const inverse = owner.entity.getWorldTransform().clone().invert();
    this.positions = new Float32Array(impactTriangles(pc, [this.source], inverse).flat());
    if (!this.positions.length) {
      return;
    }
    const from = owner.position.clone().add(new pc.Vec3(0, 0.2, 0));
    const to = owner.position.clone().sub(new pc.Vec3(0, 2, 0));
    const hit = app.systems.rigidbody.raycastFirst(from, to, { filterCallback: LatchFloorPuddle.#isFloor });
    this.floor = hit?.point ? inverse.transformPoint(hit.point).y + 0.009 : 0.009;
    this.indices = Array.from({ length: this.positions.length / 3 }, LatchFloorPuddle.#index);
    const body = this.#createPart(this.source, this.positions, true);
    this.entity = body.entity;
    this.mesh = body.mesh;
    this.instance = body.instance;
    let low = Infinity, high = -Infinity;
    for (let i = 1; i < this.positions.length; i += 3) {
      low = Math.min(low, this.positions[i]);
      high = Math.max(high, this.positions[i]);
    }
    this.heightRange = {
      low,
      high,
    };
    for (const original of this.originals) {
      if (original !== this.source) {
        const positions = new Float32Array(impactTriangles(pc, [original], inverse).flat());
        this.#createPart(original, positions, false);
      }
    }
    for (const original of this.originals) {
      original.visible = false;
    }
    this.active = true;
    this.update(0);
  }

  /**
   * @param {import("playcanvas").MeshInstance} source
   * @param {Float32Array} positions
   * @param {boolean} isBody
   * @returns {{entity:import("playcanvas").Entity,mesh:import("playcanvas").Mesh,instance:import("playcanvas").MeshInstance,source:import("playcanvas").MeshInstance,positions:Float32Array,indices:number[],isBody:boolean,material:import("playcanvas").StandardMaterial|null}}
   */
  #createPart(source, positions, isBody) {
    const { pc, app } = this.owner;
    const entity = new pc.Entity("Yielding slug skin", app);
    this.owner.entity.addChild(entity);
    const mesh = new pc.Mesh(app.graphicsDevice);
    const indices = Array.from({ length: positions.length / 3 }, LatchFloorPuddle.#index);
    mesh.setPositions(positions);
    mesh.setIndices(indices);
    mesh.setNormals(pc.calculateNormals(positions, indices));
    mesh.update();
    const material = isBody ? null : source.material.clone();
    if (material) {
      material.blendType = pc.BLEND_NORMAL;
      material.depthWrite = false;
      material.update();
    }
    const instance = new pc.MeshInstance(mesh, material ?? source.material, entity);
    instance.cull = false;
    instance.castShadow = false;
    entity.addComponent("render", { meshInstances: [instance] });
    const part = {
      entity,
      mesh,
      instance,
      source,
      positions,
      indices,
      isBody,
      material,
    };
    this.parts.push(part);

    return part;
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {boolean}
   */
  static #isBody(instance) {
    return !/eye|tip/i.test(instance.material.name);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #isFloor(entity) {
    return entity.rigidbody?.type === "static";
  }

  /**
   * @param {number} value
   * @param {number} index
   * @returns {number}
   */
  static #index(value, index) {
    return index;
  }

  /**
   * @param {Float32Array} source
   * @param {number} age
   * @param {number} floor
   * @param {{low:number,high:number}|null} heightRange
   * @returns {Float32Array}
   */
  static collapse(source, age, floor, heightRange = null) {
    const soften = LatchFloorPuddle.#ease(age / 0.35);
    const spill = LatchFloorPuddle.#ease((age - 0.25) / (COLLAPSE_DURATION - 0.25));
    const result = new Float32Array(source.length);
    let low = heightRange?.low ?? Infinity, high = heightRange?.high ?? -Infinity;
    if (!heightRange) {
      for (let i = 1; i < source.length; i += 3) {
        low = Math.min(low, source[i]);
        high = Math.max(high, source[i]);
      }
    }
    for (let i = 0; i < source.length; i += 3) {
      const x = source[i], y = source[i + 1], z = source[i + 2];
      const height = (y - low) / Math.max(0.01, high - low);
      const angle = Math.atan2(z, x);
      // Different sides lose support at different times. Upper gel slumps to
      // one side while the belly bulges, rather than scaling the whole body.
      const delay = 0.07 * (1 + Math.sin(angle * 2 + 0.8));
      const yieldAmount = LatchFloorPuddle.#ease((age - 0.12 - delay) / (COLLAPSE_DURATION - 0.26));
      const support = (1 - yieldAmount) ** 2;
      const strain = soften * (1 - spill);
      const tremble = Math.sin(age * 23 + angle * 1.4) * Math.exp(-Math.max(0, age) * 3) * 0.045 * strain;
      const ripple = Math.sin(angle * 5 + 0.7) * 0.04 * spill;
      const belly = (1 - height) * 0.2 * strain;
      result[i] = x * (1 + 0.45 * spill + belly + tremble + ripple) + height * 0.14 * strain;
      result[i + 1] = y * support * (1 - 0.22 * strain) + (floor + 0.016 * height) * (1 - support);
      result[i + 2] = z * (1 + 0.35 * spill + belly - tremble + ripple) - height * 0.07 * strain;
    }

    return result;
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  static #ease(value) {
    const t = Math.min(1, Math.max(0, value));

    return t * t * (3 - 2 * t);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!this.active || !Number.isFinite(dt) || dt < 0) {
      return;
    }
    this.age += dt;
    const fade = Math.min(1, Math.max(0, (10 - this.age) / 2));
    const opacity = (this.owner.gelMass.opacity * Math.max(0, 1 - this.age / COLLAPSE_DURATION) + 0.24 * Math.min(1, this.age / COLLAPSE_DURATION)) * fade;
    for (const part of this.parts) {
      part.entity.enabled = part.isBody || this.age < 0.85;
      if (!part.entity.enabled) {
        continue;
      }
      const positions = LatchFloorPuddle.collapse(part.positions, this.age, this.floor, this.heightRange);
      part.mesh.setPositions(positions);
      part.mesh.setNormals(this.owner.pc.calculateNormals(positions, part.indices));
      part.mesh.update();
      for (const [name, parameter] of Object.entries(part.source.parameters)) {
        part.instance.setParameter(name, parameter.data);
      }
      part.instance.setParameter("material_opacity", part.isBody ? opacity : Math.max(0, 1 - this.age / 0.85));
    }
    if (!this.sounded && this.age >= 0.55) {
      this.sounded = true;
      this.owner.audio?.play("splash", 0.85);
    }
    this.active = this.age < 10;
  }

  destroy() {
    this.active = false;
    for (const part of this.parts) {
      part.entity.destroy();
      part.mesh.destroy();
      part.material?.destroy();
    }
    this.parts = [];
  }
}
