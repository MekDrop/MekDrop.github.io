/**
 * A reusable burst of water travelling out of the portal toward its visitor.
 */
export class GatewayRepulsionEffect {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   * @type {number}
   */
  #remaining = 0;
  /**
   * @type {number}
   */
  #lifetime;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {import("playcanvas").Entity} parent
   * @param {number} cubeSize
   * @param {{lifetime?:number,speed?:number}} [options]
   */
  constructor(pc, device, parent, cubeSize, options = {}) {
    this.#lifetime = options.lifetime ?? 0.24;
    const speed = options.speed ?? 1;
    const size = 32;
    this.#texture = new pc.Texture(device, {
      name: "Gateway water droplet",
      width: size,
      height: size,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
    });
    const pixels = this.#texture.lock();
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distance = Math.hypot((x + 0.5) / 16 - 1, (y + 0.5) / 16 - 1);
        const alpha = Math.max(0, 1 - distance);
        pixels.set([255, 255, 255, Math.round(alpha * alpha * 255)], (y * size + x) * 4);
      }
    }
    this.#texture.unlock();
    this.#entity = new pc.Entity("Gateway repulsion spray");
    parent.addChild(this.#entity);
    this.#entity.addComponent("particlesystem", {
      numParticles: 36,
      lifetime: this.#lifetime,
      rate: 0.001,
      loop: false,
      autoPlay: false,
      lighting: false,
      depthWrite: false,
      localSpace: true,
      blendType: pc.BLEND_NORMAL,
      colorMap: this.#texture,
      emitterExtents: new pc.Vec3(cubeSize * 0.2, cubeSize * 1.6, cubeSize * 1.8),
      localVelocityGraph: new pc.CurveSet([0, 6.4 * speed, 1, 3.6 * speed], [0, 0.3, 1, -0.5], [0, -0.35, 1, -0.1]),
      localVelocityGraph2: new pc.CurveSet([0, 8 * speed, 1, 4.4 * speed], [0, 0.7, 1, -0.3], [0, 0.35, 1, 0.1]),
      scaleGraph: new pc.Curve([0, 0.035, 0.2, 0.065, 1, 0.008]),
      alphaGraph: new pc.Curve([0, 0, 0.08, 0.85, 0.65, 0.5, 1, 0]),
      colorGraph: new pc.CurveSet([0, 0.5, 1, 0.85], [0, 0.85, 1, 0.95], [0, 1, 1, 1]),
      alignToMotion: true,
      stretch: 0.04,
    });
    this.#entity.enabled = false;
  }

  /**
   * @param {number} side
   * @param {number} z
   * @param {number} cubeSize
   */
  play(side, z, cubeSize) {
    this.#entity.setLocalPosition(side * 0.09, cubeSize * 1.8, z);
    this.#entity.setLocalEulerAngles(0, side > 0 ? 0 : 180, 0);
    this.#entity.enabled = true;
    this.#entity.particlesystem.reset();
    this.#entity.particlesystem.play();
    const instance = this.#entity.particlesystem.emitter?.meshInstance;
    if (instance) {
      instance.cull = false;
    }
    this.#remaining = this.#lifetime + 0.06;
  }

  /**
   * Compile the same particle variant behind opaque terrain during loading.
   * @param {number} cubeSize
   */
  prewarm(cubeSize) {
    this.play(-1, 0, cubeSize);
    this.#entity.setLocalPosition(0, -20, 0);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    // Map constructors run before their root is attached to the application;
    // PlayCanvas creates the native emitter when that hierarchy is enabled.
    const instance = this.#entity.particlesystem.emitter?.meshInstance;
    if (instance) {
      instance.cull = false;
    }
    if (this.#remaining <= 0) {
      return;
    }
    this.#remaining -= deltaTime;
    if (this.#remaining <= 0) {
      this.#entity.particlesystem.stop();
      this.#entity.enabled = false;
    }
  }

  destroy() {
    this.#entity.destroy();
    this.#texture.destroy();
  }
}
