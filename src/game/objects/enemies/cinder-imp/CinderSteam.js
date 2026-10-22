/**
 * Transient engine particles for the fire/frost reaction; no authored mesh.
 */
export class CinderSteam {
  /**
   * @param {import("./CinderImp.js").CinderImp} owner
   * @param {import("playcanvas").Vec3} position
   */
  constructor(owner, position) {
    const pc = owner.pc;
    this.remaining = 0.9;
    this.entity = new pc.Entity("Fire and frost steam");
    this.entity.setPosition(position.x, position.y + 0.45, position.z);
    this.entity.addComponent("particlesystem", {
      numParticles: 24,
      lifetime: 0.55,
      rate: 0.012,
      rate2: 0.02,
      loop: false,
      lighting: false,
      depthWrite: false,
      blendType: pc.BLEND_NORMAL,
      emitterExtents: new pc.Vec3(0.35, 0.15, 0.35),
      localVelocityGraph: new pc.CurveSet([[0, -0.2, 1, 0.2], [0, 0.9, 1, 0.5], [0, -0.2, 1, 0.2]]),
      scaleGraph: new pc.Curve([0, 0.08, 0.65, 0.35, 1, 0.5]),
      colorGraph: new pc.CurveSet([[0, 0.9, 1, 0.6], [0, 0.95, 1, 0.7], [0, 1, 1, 0.8]]),
      alphaGraph: new pc.Curve([0, 0, 0.12, 0.6, 1, 0]),
    });
    (owner.runtime.root ?? owner.app.root).addChild(this.entity);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.destroy();
    }
  }

  destroy() {
    this.entity?.destroy();
    this.entity = null;
    this.remaining = 0;
  }
}
