/**
 * Pooled short-range flame emission; the authored rig supplies its mouth mount.
 */
export class CinderBreath {
  /**
   * @param {import("./CinderImp.js").CinderImp} owner
   */
  constructor(owner) {
    this.owner = owner;
    const pc = owner.pc;
    this.entity = new pc.Entity("Cinder short fire breath");
    this.entity.addComponent("particlesystem", {
      numParticles: 64,
      lifetime: 0.28,
      rate: 0.006,
      loop: true,
      localSpace: false,
      lighting: false,
      depthWrite: false,
      blendType: pc.BLEND_ADDITIVE,
      emitterExtents: new pc.Vec3(0.07, 0.04, 0.04),
      colorMap: owner.app.assets.find("castleFireParticle", "texture").resource,
      velocityGraph: new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, -5, 1, -5]),
      scaleGraph: new pc.Curve([0, 0.04, 0.35, 0.11, 1, 0]),
      colorGraph: new pc.CurveSet([0, 1, 1, 0.8], [0, 0.9, 1, 0.08], [0, 0.25, 1, 0]),
      alphaGraph: new pc.Curve([0, 0, 0.12, 0.9, 1, 0]),
    });
    (owner.runtime.root ?? owner.app.root).addChild(this.entity);
    this.entity.enabled = false;
  }

  update() {
    const owner = this.owner;
    const active = owner.alive && owner.clip === "fire_loop" && !owner.carrier && !owner.airborne;
    if (active && !this.entity.enabled) {
      this.entity.enabled = true;
      const pc = owner.pc;
      const direction = owner.entity.forward;
      this.entity.particlesystem.velocityGraph = new pc.CurveSet(
        [0, direction.x * 5, 1, direction.x * 5],
        [0, direction.y * 5, 1, direction.y * 5],
        [0, direction.z * 5, 1, direction.z * 5],
      );
      this.entity.particlesystem.reset();
      this.entity.particlesystem.play();
    }
    if (!active) {
      this.entity.enabled = false;

      return;
    }
    // Furnace bone's rest +Y points up; this local offset reaches the front mouth.
    const furnace = owner.modelRoot.findByName("Furnace");
    const mouth = furnace.getWorldTransform().transformPoint(new owner.pc.Vec3(0, -0.0528, 0.2707));
    this.entity.setPosition(mouth);
  }

  destroy() {
    this.entity.destroy();
  }
}
