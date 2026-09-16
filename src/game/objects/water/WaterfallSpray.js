// Short-lived droplets detach from the lower half of the curtain and kick up at landings.
export class WaterfallSpray {
  #pc;
  #texture;

  constructor(pc, device) {
    this.#pc = pc;
    this.entity = new pc.Entity('Waterfall splash layers');
    this.#texture = this.#createTexture(device);
  }

  add(waterfall, cols, rows, terminal) {
    const directions = {
      NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0],
    };
    const flow = directions[waterfall.direction];
    const cross = [-flow[1], flow[0]];
    const drop = waterfall.topElevation - waterfall.bottomElevation;
    const center = [
      waterfall.col - (cols - 1) / 2,
      waterfall.row - (rows - 1) / 2,
    ];
    const radius = Math.min(0.22, drop * 0.22);
    const taper = Math.min(1, Math.max(0, (drop - 4) / 2)) * 0.18;
    for (const progress of [0.5, 0.7, 0.88]) {
      const remaining = drop * (1 - progress);
      const fall = Math.max(0, (drop * progress - radius) / Math.max(0.01, drop - radius));
      // Fill the air pocket between the upstream cliff (forward 0.5)
      // and the rear of the curtain, rather than its outward-facing skin.
      const forward = 0.5 + radius * 0.45 + fall * fall * (terminal ? 0.036 : 0.012);
      this.#emit(
        center, flow, cross, forward,
        waterfall.bottomElevation + remaining,
        Math.min(0.42, Math.max(0.14, remaining * 0.48)),
        Math.min(0.08, remaining * 0.12), false,
        0.84 * (1 - taper),
      );
    }
    if (!terminal) {
      this.#emit(
        center, flow, cross, 0.5 + radius * 0.45,
        waterfall.bottomElevation + 0.045, 0.36, 0.015, true,
      );
    }
  }

  destroy() {
    this.entity.destroy();
    this.#texture.destroy();
  }

  #emit(center, flow, cross, forward, height, lifetime, verticalExtent, impact, width = 0.84) {
    const pc = this.#pc;
    const emitter = new pc.Entity(impact ? 'Waterfall landing splashes' : 'Waterfall airborne splashes');
    emitter.setLocalPosition(
      center[0] + flow[0] * forward, height, center[1] + flow[1] * forward,
    );
    // Confine the spray to the pocket behind the sheet. The opaque curtain
    // naturally hides it head-on while side views reveal the falling droplets.
    const velocity = (spread, speed, finalSpeed) => this.#curves(
      [0, flow[0] * speed + cross[0] * spread, 1, flow[0] * finalSpeed],
      impact ? [0, 0.75, 1, -0.85] : [0, -0.28, 1, -1.5],
      [0, flow[1] * speed + cross[1] * spread, 1, flow[1] * finalSpeed],
    );
    emitter.addComponent('particlesystem', {
      numParticles: 12,
      lifetime,
      rate: lifetime / 10,
      rate2: lifetime / 7,
      loop: true,
      preWarm: true,
      lighting: false,
      depthWrite: false,
      noFog: true,
      localSpace: true,
      blendType: pc.BLEND_NORMAL,
      sort: pc.PARTICLESORT_OLDER_FIRST,
      orientation: pc.PARTICLEORIENTATION_SCREEN,
      emitterShape: pc.EMITTERSHAPE_BOX,
      // PlayCanvas box extents are full dimensions, not half-extents.
      // Cover the curtain while allowing for lateral drift and droplet size.
      emitterExtents: new pc.Vec3(
        Math.abs(cross[0]) * width + Math.abs(flow[0]) * 0.05,
        verticalExtent,
        Math.abs(cross[1]) * width + Math.abs(flow[1]) * 0.05,
      ),
      initialVelocity: 0,
      colorMap: this.#texture,
      alignToMotion: true,
      stretch: 0.016,
      localVelocityGraph: velocity(-0.08, 0.015, 0.025),
      localVelocityGraph2: velocity(0.08, 0.065, 0.055),
      scaleGraph: this.#curve([0, 0.008, 0.18, 0.016, 0.7, 0.01, 1, 0]),
      scaleGraph2: this.#curve([0, 0.013, 0.2, 0.026, 0.7, 0.016, 1, 0]),
      colorGraph: this.#curves(
        [0, 0.67, 0.35, 0.84, 1, 0.65],
        [0, 0.84, 0.35, 0.94, 1, 0.84],
        [0, 0.8, 0.35, 0.9, 1, 0.8],
      ),
      alphaGraph: this.#curve([0, 0, 0.16, 0.58, 0.6, 0.38, 1, 0]),
    });
    this.entity.addChild(emitter);
  }

  #curve(keys) {
    const curve = new this.#pc.Curve(keys);
    curve.type = this.#pc.CURVE_SMOOTHSTEP;
    return curve;
  }

  #curves(...channels) {
    const curves = new this.#pc.CurveSet(channels);
    curves.type = this.#pc.CURVE_SMOOTHSTEP;
    return curves;
  }

  #createTexture(device) {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = (x + 0.5) / size * 2 - 1;
        const py = (y + 0.5) / size * 2 - 1;
        const distance = Math.hypot(px * 1.35, py);
        const edge = Math.max(0, Math.min(1, (0.88 - distance) / 0.38));
        const index = (y * size + x) * 4;
        pixels.set([255, 255, 255, Math.round(edge * edge * (3 - 2 * edge) * 255)], index);
      }
    }
    const texture = new this.#pc.Texture(device, {
      name: 'Waterfall splash droplet', width: size, height: size,
      format: this.#pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: true,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.lock().set(pixels);
    texture.unlock();
    return texture;
  }
}
