/**
 * Contact-driven toe placement. The socket stays on its authored bone; the
 * distal leg mesh bends to the surface instead of passing through the body.
 */
export class BellBugScoopFoot {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {import("playcanvas").Entity} model
   * @param {number} side
   */
  constructor(owner, model, side) {
    this.owner = owner;
    this.bone = model.findByName(`leg_${side ? "R" : "L"}_0`);
    this.instances = [];
    const renders = model.findByName(`BellBug leg ${side ? "R" : "L"}0`)?.findComponents("render") ?? [];
    for (const render of renders) {
      this.instances.push(...render.meshInstances);
    }
    this.instance = this.instances[0];
    this.original = null;
    this.mesh = null;
    if (!this.bone || !this.instance) {
      return;
    }
    const { pc } = owner;
    this.parts = [];
    this.tip = new pc.Vec3();
    const point = new pc.Vec3();
    let farthest = 0;
    for (const instance of this.instances) {
      const part = {
        instance,
        source: instance.mesh,
        positions: [],
        indices: [],
        uvs: [],
        mesh: null,
      };
      part.source.getPositions(part.positions);
      part.source.getIndices(part.indices);
      part.source.getUvs(0, part.uvs);
      part.socket = instance.node.getWorldTransform().clone().invert().transformPoint(this.bone.getPosition());
      this.parts.push(part);
      for (let i = 0; i < part.positions.length; i += 3) {
        point.set(part.positions[i], part.positions[i + 1], part.positions[i + 2]);
        const distance = instance.node.getWorldTransform().transformPoint(point).distance(this.bone.getPosition());
        if (distance > farthest) {
          farthest = distance;
          this.tipPart = part;
          this.tip.copy(point);
          this.tipIndex = i;
        }
      }
    }
    // Material primitives include separate armor, distal claw and hip joint.
    Object.assign(this, this.tipPart);
    this.length = this.point.distance(this.bone.getPosition());
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get point() {
    return this.instance.node.getWorldTransform().transformPoint(this.tip);
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {boolean}
   */
  canReach(point) {
    return Boolean(this.source && this.bone.getPosition().distance(point) <= this.length * 1.55);
  }

  /**
   * Horizontal travel needed to reach the skin with room for its 3.5 cm press.
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} direction Normalized ground direction.
   * @param {number} margin Clearance reserved for surface deformation.
   * @returns {number|null}
   */
  approachDistance(point, direction, margin = 0.035) {
    if (!this.source) {
      return null;
    }
    const offset = this.bone.getPosition().clone().sub(point);
    const along = offset.dot(direction);
    const radius = Math.max(0, this.length * 1.55 - margin);
    const discriminant = along * along + radius * radius - offset.lengthSq();

    return discriminant >= 0 ? Math.max(0, -along - Math.sqrt(discriminant)) : null;
  }

  /**
   * @param {import("playcanvas").Vec3} goal
   */
  pose(goal) {
    if (!this.source) {
      return;
    }
    const { pc } = this.owner;
    this.original = this.bone.getLocalRotation().clone();
    const pivot = this.bone.getPosition().clone();
    const from = this.point.sub(pivot).normalize();
    const to = goal.clone().sub(pivot).normalize();
    const rotation = new pc.Quat().setFromDirections(from, to);
    this.bone.setRotation(rotation.mul(this.bone.getRotation().clone()));
    const correction = goal.clone().sub(this.point);
    for (const part of this.parts) {
      const delta = part.instance.node.getWorldTransform().clone().invert().transformVector(correction);
      const positions = new Float32Array(part.positions);
      const point = new pc.Vec3();
      for (let i = 0; i < positions.length; i += 3) {
        point.set(positions[i], positions[i + 1], positions[i + 2]);
        const distance = part.instance.node.getWorldTransform().transformPoint(point).distance(pivot);
        const weight = Math.max(0, Math.min(1, (distance / this.length - 0.3) / 0.7));
        point.add(delta.clone().mulScalar(weight * weight));
        positions.set([point.x, point.y, point.z], i);
      }
      part.mesh ??= new pc.Mesh(this.owner.app.graphicsDevice);
      part.mesh.setPositions(positions);
      part.mesh.setIndices(part.indices);
      part.mesh.setNormals(pc.calculateNormals(positions, part.indices));
      if (part.uvs.length) {
        part.mesh.setUvs(0, part.uvs);
      }
      part.mesh.update();
      part.instance.mesh = part.mesh;
      if (part === this.tipPart) {
        this.mesh = part.mesh;
        this.contactPoint = part.instance.node.getWorldTransform().transformPoint(new pc.Vec3(positions[this.tipIndex], positions[this.tipIndex + 1], positions[this.tipIndex + 2]));
      }
    }
  }

  restore() {
    if (this.original) {
      this.bone.setLocalRotation(this.original);
      this.original = null;
      for (const part of this.parts) {
        part.instance.mesh = part.source;
      }
    }
  }

  destroy() {
    this.restore();
    for (const part of this.parts ?? []) {
      part.mesh?.destroy();
    }
  }
}
