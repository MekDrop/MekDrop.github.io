/**
 * One reusable native emitter: a few tiny drops at a successful claw contact.
 */
export class BellBugScratchBlood {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  attach() {
    if (this.entity) {
      return;
    }
    const { pc, app } = this.owner;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(16, 16, 3, 16, 16, 15);
    gradient.addColorStop(0, "white");
    gradient.addColorStop(0.65, "white");
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    this.texture = new pc.Texture(app.graphicsDevice, { mipmaps: false });
    this.texture.setSource(canvas);
    this.entity = new pc.Entity("Bell Bug scratch drops");
    app.root.addChild(this.entity);
    this.entity.addComponent("particlesystem", {
      numParticles: 3,
      lifetime: 0.22,
      rate: 0.008,
      loop: false,
      autoPlay: false,
      lighting: false,
      depthWrite: false,
      localSpace: false,
      blendType: pc.BLEND_NORMAL,
      colorMap: this.texture,
      emitterExtents: new pc.Vec3(0.008, 0.008, 0.008),
      localVelocityGraph: new pc.CurveSet([[0, -0.08], [0, 0.05, 1, -0.25], [0, 0.6, 1, 0.2]]),
      localVelocityGraph2: new pc.CurveSet([[0, 0.08], [0, 0.12, 1, -0.4], [0, 0.9, 1, 0.3]]),
      scaleGraph: new pc.Curve([0, 0.032, 0.25, 0.04, 1, 0.008]),
      colorGraph: new pc.CurveSet([[0, 0.7, 1, 0.4], [0, 0.015], [0, 0.025]]),
      alphaGraph: new pc.Curve([0, 1, 0.55, 0.9, 1, 0]),
    });
    this.entity.particlesystem.stop();
    this.handle = app.on("bell-bug:scratch-contact", this.#emit, this);
  }

  /**
   * @param {{bug:import("./BellBug.js").BellBug,point:import("playcanvas").Vec3,direction:import("playcanvas").Vec3}} event
   */
  #emit(event) {
    if (event.bug !== this.owner) {
      return;
    }
    const point = event.point.clone();
    const camera = this.owner.runtime.camera?.entity ?? this.owner.app.root.findComponent("camera")?.entity;
    if (camera) {
      point.add(camera.getPosition().clone().sub(point).normalize().mulScalar(0.025));
    }
    this.entity.setPosition(point);
    this.entity.setEulerAngles(0, Math.atan2(event.direction.x, event.direction.z) * 180 / Math.PI, 0);
    this.entity.particlesystem.reset();
    this.entity.particlesystem.play();
  }

  destroy() {
    this.handle?.off();
    this.entity?.destroy();
    this.texture?.destroy();
  }
}
