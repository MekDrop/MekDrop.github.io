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
    this.instance = model.findByName(`BellBug leg ${side ? "R" : "L"}0`)?.findComponents("render")[0]?.meshInstances[0];
    this.original = null;
    this.mesh = null;
    if (!this.bone || !this.instance) {
      return;
    }
    const { pc } = owner;
    this.source = this.instance.mesh;
    this.positions = [];
    this.indices = [];
    this.uvs = [];
    this.source.getPositions(this.positions);
    this.source.getIndices(this.indices);
    this.source.getUvs(0, this.uvs);
    const inverse = this.instance.node.getWorldTransform().clone().invert();
    this.socket = inverse.transformPoint(this.bone.getPosition());
    this.tip = new pc.Vec3();
    const point = new pc.Vec3();
    let farthest = 0;
    for (let i = 0; i < this.positions.length; i += 3) {
      point.set(this.positions[i], this.positions[i + 1], this.positions[i + 2]);
      if (point.distance(this.socket) > farthest) {
        farthest = point.distance(this.socket);
        this.tip.copy(point);
        this.tipIndex = i;
      }
    }
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
    const inverse = this.instance.node.getWorldTransform().clone().invert();
    const delta = inverse.transformVector(goal.clone().sub(this.point));
    const positions = new Float32Array(this.positions);
    const point = new pc.Vec3();
    const length = this.tip.distance(this.socket);
    for (let i = 0; i < positions.length; i += 3) {
      point.set(positions[i], positions[i + 1], positions[i + 2]);
      const weight = Math.max(0, Math.min(1, (point.distance(this.socket) / length - 0.3) / 0.7));
      point.add(delta.clone().mulScalar(weight * weight));
      positions.set([point.x, point.y, point.z], i);
    }
    this.mesh ??= new pc.Mesh(this.owner.app.graphicsDevice);
    this.mesh.setPositions(positions);
    this.mesh.setIndices(this.indices);
    this.mesh.setNormals(pc.calculateNormals(positions, this.indices));
    if (this.uvs.length) {
      this.mesh.setUvs(0, this.uvs);
    }
    this.mesh.update();
    this.instance.mesh = this.mesh;
    this.contactPoint = this.instance.node.getWorldTransform().transformPoint(new pc.Vec3(positions[this.tipIndex], positions[this.tipIndex + 1], positions[this.tipIndex + 2]));
  }

  restore() {
    if (this.original) {
      this.bone.setLocalRotation(this.original);
      this.original = null;
      this.instance.mesh = this.source;
    }
  }

  destroy() {
    this.restore();
    this.mesh?.destroy();
  }
}
