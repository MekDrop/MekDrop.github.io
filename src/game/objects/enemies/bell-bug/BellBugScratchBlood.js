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
    this.marks = [];
    this.markIndex = 0;
    this.material = new pc.StandardMaterial();
    this.material.useLighting = false;
    this.material.diffuse.set(0, 0, 0);
    this.material.emissive.set(0.42, 0.004, 0.012);
    this.material.opacityMap = this.texture;
    this.material.opacityMapChannel = "a";
    this.material.blendType = pc.BLEND_NORMAL;
    this.material.depthWrite = false;
    this.material.update();
    for (let i = 0; i < 4; i++) {
      const entity = new pc.Entity("Fading scratch blood on ground");
      app.root.addChild(entity);
      entity.addComponent("render", {
        type: "plane",
        material: this.material,
        castShadows: false,
        receiveShadows: false,
      });
      entity.setLocalScale(0.11, 1, 0.075);
      entity.enabled = false;
      this.marks.push({
        entity,
        age: Infinity,
      });
    }
    this.updateHandle = app.on("update", this.#update, this);
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
    // The claw gives each burst a small, directional flick rather than
    // depositing every drop at the same point beneath the victim.
    const angle = Math.atan2(event.direction.x, event.direction.z) + (Math.random() - 0.5) * 0.4;
    const speed = 0.6 + Math.random() * 0.4;
    const direction = new this.owner.pc.Vec3(Math.sin(angle), 0, Math.cos(angle));
    this.entity.setEulerAngles(0, angle * 180 / Math.PI, 0);
    const floorAtContact = this.#floor(point);
    const fallTime = floorAtContact ? Math.max(0.04, (point.y - floorAtContact.point.y) / 0.8) : 0.3;
    const landing = point.clone().add(direction.mulScalar(speed * fallTime));
    const floor = this.#floor(landing);
    const { pc } = this.owner;
    const particles = this.entity.particlesystem;
    particles.lifetime = fallTime;
    // Keep the same tiny drops; native per-particle velocity adds a narrow fan.
    particles.localVelocityGraph = new pc.CurveSet([[0, -0.08], [0, -0.8], [0, speed * 0.9]]);
    particles.localVelocityGraph2 = new pc.CurveSet([[0, 0.08], [0, -0.8], [0, speed * 1.1]]);
    particles.alphaGraph = new pc.Curve([0, 1, 0.85, 1, 1, 0]);
    if (floor) {
      const mark = this.marks[this.markIndex++ % this.marks.length];
      mark.age = -fallTime;
      mark.entity.enabled = false;
      mark.entity.setPosition(floor.point.clone().add(floor.normal.clone().mulScalar(0.008)));
      mark.entity.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, floor.normal));
    }
    this.entity.particlesystem.reset();
    this.entity.particlesystem.play();
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").RaycastResult|undefined}
   */
  #floor(point) {
    const hits = this.owner.app.systems.rigidbody.raycastAll(
      point.clone().add(new this.owner.pc.Vec3(0, 0.05, 0)),
      point.clone().sub(new this.owner.pc.Vec3(0, 2, 0)),
    );

    return hits.filter(/**
     *
     * @param {import("playcanvas").RaycastResult} hit
     */
      hit => hit.entity.rigidbody?.type === "static" && hit.normal.y > 0.65)
      .sort(/**
       *
       * @param {import("playcanvas").RaycastResult} a
       * @param {import("playcanvas").RaycastResult} b
       */
        (a, b) => b.point.y - a.point.y)[0];
  }

  /**
   * Schedule the ground contact and fade the pooled spot after it lands.
   * @param {number} dt
   */
  #update(dt) {
    for (const mark of this.marks) {
      if (!Number.isFinite(mark.age)) {
        continue;
      }
      mark.age += dt;
      mark.entity.enabled = mark.age >= 0 && mark.age < 2;
      if (mark.entity.enabled) {
        const opacity = 0.7 * Math.min(1, mark.age / 0.06) * Math.min(1, (2 - mark.age) / 0.8);
        mark.entity.render.meshInstances[0].setParameter("material_opacity", opacity);
      }
      if (mark.age >= 2) {
        mark.age = Infinity;
      }
    }
  }

  destroy() {
    this.handle?.off();
    this.updateHandle?.off();
    for (const mark of this.marks ?? []) {
      mark.entity.destroy();
    }
    this.material?.destroy();
    this.entity?.destroy();
    this.texture?.destroy();
  }
}
