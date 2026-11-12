import { CastleAudio } from "../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../audio/GameObjectAudio.js";

/**
 * Castle-owned mist and sparks, kept outside the replaced map hierarchy.
 */
export class CastleSwapEffect {
  /**
   * @type {GameObjectAudio|undefined}
   */
  #audio;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #updateHandle;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {number|null}
   */
  #fadeElapsed = null;
  /**
   * @type {number}
   */
  #opacity = 0;
  /**
   * @type {number}
   */
  #fadeStart = 0;
  /**
   * @type {import("playcanvas").CurveSet}
   */
  #releaseVelocity;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}}
   */
  #bounds;
  /**
   * @type {number}
   */
  #groundY;
  /**
   * @type {Uint8Array}
   */
  #alphas = new Uint8Array(32 * 32);

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {{x:number,z:number,width:number,depth:number,elevation?:number}} footprint
   * @param {import("playcanvas").Entity|null} castle
   * @param {import("../../audio/GameAudioLibrary.js").GameAudioLibrary} [audioLibrary]
   */
  constructor(pc, app, footprint, castle = null, audioLibrary) {
    this.#pc = pc;
    let bounds = null;
    for (const render of castle?.findComponents("render") ?? []) {
      for (const mesh of render.meshInstances) {
        if (bounds) {
          bounds.add(mesh.aabb);
        } else {
          bounds = mesh.aabb.clone();
        }
      }
    }
    // The aggregate render bounds can extend into a basement. The authored
    // elevation is the old castle's ground level, including its island offset.
    const islandY = castle?.getPosition?.().y ?? 0;
    const groundY = Number.isFinite(footprint.elevation)
      ? footprint.elevation + islandY
      : bounds ? bounds.center.y - bounds.halfExtents.y : 3;
    const volume = {
      width: bounds ? bounds.halfExtents.x * 2 : footprint.width,
      depth: bounds ? bounds.halfExtents.z * 2 : footprint.depth,
      height: bounds ? Math.max(1, bounds.center.y + bounds.halfExtents.y - groundY) : 5,
    };
    const center = {
      x: bounds?.center.x ?? footprint.x + footprint.width / 2,
      y: groundY + volume.height / 2,
      z: bounds?.center.z ?? footprint.z + footprint.depth / 2,
    };
    this.#bounds = {
      minX: center.x - volume.width / 2,
      maxX: center.x + volume.width / 2,
      minY: center.y - volume.height / 2,
      maxY: center.y + volume.height / 2,
      minZ: center.z - volume.depth / 2,
      maxZ: center.z + volume.depth / 2,
    };
    this.#groundY = groundY;
    this.#releaseVelocity = new pc.CurveSet(
      [0, volume.height * 0.35, 1, volume.height * 0.35],
      [0, volume.height * 0.15, 1, volume.height * 0.15],
      [0, volume.height * 0.18, 1, volume.height * 0.18],
    );
    this.#root = new pc.Entity("Castle transformation");
    app.root.addChild(this.#root);
    if (audioLibrary) {
      this.#audio = new GameObjectAudio(this.#root, app, audioLibrary, {
        mist: CastleAudio.transition,
        reveal: CastleAudio.transitionRelease,
      }, 0.5);
      const mist = this.#root.sound.slot("mist");
      mist.loop = true;
      mist.volume = 0;
      this.#audio.resume();
      this.#audio.play("mist");
    }
    this.#root.setPosition(center.x, center.y, center.z);
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Castle soft mist",
      width: 32,
      height: 32,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
    });
    const pixels = this.#texture.lock();
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const alpha = Math.max(0, 1 - Math.hypot((x - 15.5) / 16, (y - 15.5) / 16));
        this.#alphas[y * 32 + x] = Math.round(alpha * alpha * 255);
        pixels.set([255, 255, 255, 0], (y * 32 + x) * 4);
      }
    }
    this.#texture.unlock();
    this.#addEmitter(pc, volume, false);
    this.#addEmitter(pc, volume, true);
    this.#updateHandle = app.on("update", this.#update, this);
  }

  /**
   * Expand the emitter to cover both castles before the replacement is shown.
   * Existing world-space particles stay in place while new particles fill it.
   * @param {import("../../GameContracts.js").CastleBuildPlan} plan
   * @returns {boolean} Whether the visible mist needs time to fill a larger volume.
   */
  includePlan(plan) {
    const geometry = plan?.geometry;
    if (!geometry?.boxes?.length) {
      return false;
    }
    const next = { ...this.#bounds };
    for (const box of geometry.boxes) {
      next.minX = Math.min(next.minX, box.x - box.sx / 2);
      next.maxX = Math.max(next.maxX, box.x + box.sx / 2);
      next.minZ = Math.min(next.minZ, box.z - box.sz / 2);
      next.maxZ = Math.max(next.maxZ, box.z + box.sz / 2);
      next.maxY = Math.max(next.maxY, box.y + box.sy / 2);
    }
    for (const roof of geometry.decorations?.roofs ?? []) {
      // A circumradius covers roofs at any yaw without clipping their corners.
      const radius = Math.hypot(roof.width ?? 1.4, roof.depth ?? 1.4) / 2;
      next.minX = Math.min(next.minX, roof.x - radius);
      next.maxX = Math.max(next.maxX, roof.x + radius);
      next.minZ = Math.min(next.minZ, roof.z - radius);
      next.maxZ = Math.max(next.maxZ, roof.z + radius);
      next.maxY = Math.max(next.maxY, roof.y + (roof.height ?? 0.9));
    }
    if (next.minX >= this.#bounds.minX - 0.01 && next.maxX <= this.#bounds.maxX + 0.01 &&
      next.minZ >= this.#bounds.minZ - 0.01 && next.maxZ <= this.#bounds.maxZ + 0.01 &&
      next.maxY <= this.#bounds.maxY + 0.01) {
      return false;
    }
    this.#bounds = next;
    const width = next.maxX - next.minX;
    const depth = next.maxZ - next.minZ;
    const height = next.maxY - this.#groundY;
    const size = Math.max(width, depth);
    this.#root.setPosition((next.minX + next.maxX) / 2, this.#groundY + height / 2, (next.minZ + next.maxZ) / 2);
    this.#releaseVelocity = new this.#pc.CurveSet(
      [0, height * 0.35, 1, height * 0.35],
      [0, height * 0.15, 1, height * 0.15],
      [0, height * 0.18, 1, height * 0.18],
    );
    for (const child of this.#root.children) {
      const emitter = child.particlesystem;
      const sparks = child.name === "Transformation sparks";
      child.setLocalPosition(0, -height / 2 + 0.12, 0);
      emitter.emitterExtents = new this.#pc.Vec3(width * 1.05, 0.24, depth * 1.05);
      emitter.localVelocityGraph = CastleSwapEffect.#riseVelocity(this.#pc, height, false);
      emitter.localVelocityGraph2 = CastleSwapEffect.#riseVelocity(this.#pc, height, true);
      if (!sparks) {
        emitter.scaleGraph = new this.#pc.Curve([0, size * 0.13, 0.4, size * 0.22, 1, size * 0.3]);
      }
    }

    return true;
  }

  /**
   * Start slowly enough for the mist to be visible at ground level, then rise.
   * @param {typeof import("playcanvas")} pc
   * @param {number} height
   * @param {boolean} faster
   * @returns {import("playcanvas").CurveSet}
   */
  static #riseVelocity(pc, height, faster) {
    return new pc.CurveSet(
      faster ? [0, 0.4, 1, 1.2] : [0, -0.4, 1, -1.2],
      faster ? [0, height * 0.12, 0.2, height * 0.6, 0.55, height * 2.4, 1, height * 0.6]
        : [0, height * 0.05, 0.2, height * 0.4, 0.55, height * 2, 1, height * 0.4],
      faster ? [0, 0.4, 1, 0.8] : [0, -0.4, 1, -0.8],
    );
  }

  /**
   * Stop emitting; existing particles finish as the new castle appears.
   */
  finish() {
    if (this.#fadeElapsed === null) {
      this.#audio?.play("reveal");
      this.#fadeStart = this.#opacity;
      this.#fadeElapsed = 0;
      for (const child of this.#root.children) {
        // Graph setters preserve live particles; a transform only moves new
        // emissions now that simulation and camera-distance sorting use world space.
        child.particlesystem.velocityGraph = this.#releaseVelocity;
        child.particlesystem.velocityGraph2 = this.#releaseVelocity;
      }
    }
    for (const child of this.#root.children) {
      child.particlesystem.stop();
    }
  }

  destroy() {
    this.#updateHandle.off();
    this.#root.destroy();
    this.#texture.destroy();
  }

  /**
   * Fade the shared soft texture without rebuilding particle shaders or graphs.
   * @param {number} deltaTime
   */
  #update(deltaTime) {
    const step = Math.min(Math.max(deltaTime, 0), 0.1);
    this.#elapsed += step;
    let progress = Math.min(1, this.#elapsed / 0.45);
    if (this.#fadeElapsed !== null) {
      this.#fadeElapsed += step;
      progress = Math.min(1, this.#fadeElapsed / 0.8);
    }
    const logarithmic = Math.log1p(9 * progress) / Math.log(10);
    this.#opacity = this.#fadeElapsed === null ? logarithmic : this.#fadeStart * (1 - progress * progress * (3 - 2 * progress));
    if (this.#audio) {
      this.#root.sound.slot("mist").volume = 0.38 * this.#opacity;
      if (this.#fadeElapsed !== null && this.#fadeElapsed >= 0.8) {
        this.#root.sound.stop("mist");
      }
    }
    const pixels = this.#texture.lock();
    for (let index = 0; index < this.#alphas.length; index += 1) {
      pixels[index * 4 + 3] = Math.round(this.#alphas[index] * this.#opacity);
    }
    this.#texture.unlock();
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {{width:number,depth:number,height:number}} footprint
   * @param {boolean} sparks
   */
  #addEmitter(pc, footprint, sparks) {
    const emitter = new pc.Entity(sparks ? "Transformation sparks" : "Transformation mist");
    this.#root.addChild(emitter);
    // Emit from a shallow bed at ground level; the upward front fills the castle.
    emitter.setLocalPosition(0, -footprint.height / 2 + 0.12, 0);
    const size = Math.max(footprint.width, footprint.depth);
    emitter.addComponent("particlesystem", {
      autoPlay: true,
      loop: true,
      preWarm: false,
      numParticles: sparks ? 160 : 500,
      lifetime: 1.15,
      rate: sparks ? 0.01 : 0.0032,
      emitterExtents: new pc.Vec3(footprint.width * 1.05, 0.24, footprint.depth * 1.05),
      colorMap: this.#texture,
      blendType: sparks ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL,
      lighting: false,
      depthWrite: false,
      // Fade large mist billboards where they intersect walls instead of
      // showing the hard depth-buffer seam across their soft edges.
      depthSoftening: sparks ? 0 : 0.12,
      // Alpha-blended mist must draw far particles first. World-space simulation
      // keeps particle positions in the same coordinates as the sorting camera.
      sort: sparks ? pc.PARTICLESORT_NONE : pc.PARTICLESORT_DISTANCE,
      localSpace: false,
      localVelocityGraph: CastleSwapEffect.#riseVelocity(pc, footprint.height, false),
      localVelocityGraph2: CastleSwapEffect.#riseVelocity(pc, footprint.height, true),
      colorGraph: new pc.CurveSet([0, 0.55, 1, 0.85], [0, 0.7, 1, 0.55], [0, 1, 1, 1]),
      scaleGraph: new pc.Curve(sparks ? [0, 0.07, 0.4, 0.12, 1, 0] : [0, size * 0.13, 0.4, size * 0.22, 1, size * 0.3]),
      alphaGraph: new pc.Curve(sparks ? [0, 0, 0.15, 1, 0.7, 0.8, 1, 0]
        : [0, 0.55, 0.08, 0.85, 0.7, 0.8, 1, 0]),
    });
  }
}
