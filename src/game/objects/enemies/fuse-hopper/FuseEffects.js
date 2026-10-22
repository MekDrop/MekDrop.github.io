/**
 * Engine-native warning light and one-shot explosion emitter, owned by the bomb.
 */
export class FuseEffects {
  /**
   * @param {import("./FuseHopper.js").FuseHopper} owner
   */
  constructor(owner) {
    this.owner = owner;
    const pc = owner.pc;
    this.light = new pc.Entity("Fuse warning glow");
    this.light.addComponent("light", {
      type: "point",
      color: new pc.Color(1, 0.22, 0.015),
      intensity: 0,
      range: 2.8,
      castShadows: false,
    });
    this.light.setLocalPosition(0, 0.7, 0);
    owner.entity.addChild(this.light);
    this.blast = new pc.Entity("Fuse terminal explosion");
    this.blast.addComponent("particlesystem", {
      numParticles: 48,
      lifetime: 0.55,
      rate: 0.001,
      loop: false,
      lighting: false,
      depthWrite: false,
      blendType: pc.BLEND_ADDITIVE,
      emitterExtents: new pc.Vec3(0.18, 0.18, 0.18),
      localVelocityGraph: new pc.CurveSet([0,-3,1,-0.6], [0,-1,1,1], [0,-3,1,-0.6]),
      localVelocityGraph2: new pc.CurveSet([0,3,1,0.6], [0,4,1,0.5], [0,3,1,0.6]),
      scaleGraph: new pc.Curve([0,0.08,0.3,0.22,1,0.01]),
      colorGraph: new pc.CurveSet([0,1,1,0.5], [0,0.8,1,0.08], [0,0.06,1,0.01]),
      alphaGraph: new pc.Curve([0,0,0.05,1,0.8,0.8,1,0]),
      autoPlay: false,
    });
    owner.entity.addChild(this.blast);
    this.blast.setLocalPosition(0,0.4,0);
    this.blast.particlesystem.stop();
  }

  update() {
    const owner = this.owner;
    const lit = owner.alive && owner.fuseRemaining !== null;
    this.light.light.intensity = owner.exploded ? 8 * Math.max(0, (owner.cleanupAt - owner.elapsed) / 0.65) :
      lit ? 2 + 1.5 * Math.sin(owner.elapsed * (18 + 20 * (1 - owner.fuseRemaining / owner.fuseDuration))) : 0;
  }

  explode() {
    this.blast.particlesystem.reset();
    this.blast.particlesystem.play();
  }

  destroy() {
    this.light.destroy();
    this.blast.destroy();
  }
}
