/**
 * Gate-owned visual feedback and Ammo-driven entry share one lifecycle.
 * Y is constrained only while crossing the unsupported space behind the gate;
 * horizontal travel is integrated by Ammo, not by a presentation timer.
 */
export class EnemyGatewayArrival {
  /**
   * @param {import("./Enemy.js").Enemy} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.active = false;
    this.materials = [];
  }

  /**
   * @param {import("../../gateway/Gateway.js").Gateway} gateway
   * @returns {boolean}
   */
  start(gateway) {
    const owner = this.owner, body = owner.entity.rigidbody;
    if (!owner.alive || !body || !gateway?.entrancePath) {
      return false;
    }
    this.finish();
    this.gateway = gateway;
    this.path = gateway.entrancePath(owner.radius);
    const center = this.path.from.clone().add(this.path.direction.clone().mulScalar(this.path.distance));
    const normal = this.path.direction;
    this.clipPlane = new Float32Array([normal.x, normal.y, normal.z, -center.dot(normal)]);
    this.age = 0;
    this.crossed = false;
    this.active = true;
    this.factor = body.linearFactor?.clone() ?? new owner.pc.Vec3(1, 1, 1);
    body.linearFactor = new owner.pc.Vec3(1, 0, 1);
    body.teleport(this.path.from);
    owner.faceTarget({ position: this.path.to });
    body.teleport(owner.position, owner.entity.getEulerAngles());
    body.linearVelocity = new owner.pc.Vec3();
    for (const render of owner.entity.findComponents("render")) {
      for (const instance of render.meshInstances) {
        const original = instance.material;
        if (typeof original.opacity !== "number") {
          continue;
        }
        const ghost = original.clone();
        ghost.blendType = owner.pc.BLEND_NORMAL;
        ghost.depthWrite = original.depthWrite;
        ghost.opacity = original.opacity;
        this.#clipMaterial(ghost);
        ghost.update();
        const cull = instance.cull, castShadow = instance.castShadow;
        // Prewarm the clipped variant behind the membrane. The plane, rather
        // than a material fade, reveals the creature at its normal opacity.
        instance.cull = false;
        instance.castShadow = false;
        instance.material = ghost;
        this.materials.push({
          instance,
          original,
          ghost,
          cull,
          castShadow,
        });
      }
    }
    this.cameraHandle = owner.app?.scene.on(owner.pc.EVENT_PRERENDER, this.#camera, this);
    this.#camera(owner.runtime?.camera?.component);
    gateway.trackArrival(owner);
    owner.onGatewayArrival?.(true);

    return true;
  }

  /**
   * Wrap existing jelly/skin opacity without replacing lighting or skinning.
   * @param {import("playcanvas").StandardMaterial} material
   */
  #clipMaterial(material) {
    const { pc, app } = this.owner;
    if (!app?.graphicsDevice) {
      return;
    }
    material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
    for (const language of [pc.SHADERLANGUAGE_GLSL, pc.SHADERLANGUAGE_WGSL]) {
      const wgsl = language === pc.SHADERLANGUAGE_WGSL;
      const chunks = material.getShaderChunks(language);
      const source = chunks.get("opacityPS") ?? pc.ShaderChunks.get(app.graphicsDevice, language).get("opacityPS");
      const opacity = source.replace("getOpacity()", "getGateSkinOpacity()");
      const prefix = wgsl ? "uniform." : "";
      const vector = wgsl ? "vec4f" : "vec4";
      const declarations = wgsl ? "uniform uGateClipPlane: vec4f;\nuniform uGateViewPosition: vec3f;" : "uniform vec4 uGateClipPlane;\nuniform vec3 uGateViewPosition;";
      chunks.set("opacityPS", `${declarations}\n${opacity}\n${wgsl ? "fn" : "void"} getOpacity() {
        if (dot(${vector}(vPositionW, 1.0), ${prefix}uGateClipPlane) < 0.0 ||
            dot(${vector}(${prefix}uGateViewPosition, 1.0), ${prefix}uGateClipPlane) <= 0.0) { discard; }
        getGateSkinOpacity();
      }`);
    }
    material.setParameter("uGateClipPlane", this.clipPlane);
  }

  /**
   * @param {import("playcanvas").CameraComponent} camera
   */
  #camera(camera) {
    const position = camera?.entity.getPosition() ?? this.path?.to;
    if (!position) {
      return;
    }
    for (const { ghost } of this.materials) {
      ghost.setParameter("uGateViewPosition", [position.x, position.y, position.z]);
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!this.active) {
      return;
    }
    const owner = this.owner;
    if (!owner.alive || owner.carrier || !this.gateway.entity?.parent) {
      this.finish();

      return;
    }
    this.age += dt;
    const travelled = owner.position.clone().sub(this.path.from).dot(this.path.direction);
    if (!this.crossed && travelled >= this.path.distance - owner.radius) {
      this.crossed = true;
      this.gateway.crossArrival(owner);
    }
    if (travelled >= this.path.distance * 2) {
      this.finish();

      return;
    }
    const speed = this.age < 0.6 ? 0 : 1.2;
    owner.entity.rigidbody.linearVelocity = this.path.direction.clone().mulScalar(speed);
  }

  finish() {
    this.cameraHandle?.off();
    this.cameraHandle = null;
    const wasActive = this.active;
    this.active = false;
    if (wasActive) {
      this.gateway?.releaseArrival(this.owner);
      const body = this.owner.entity.rigidbody;
      if (body) {
        body.linearFactor = this.factor;
        body.linearVelocity = new this.owner.pc.Vec3();
      }
    }
    for (const { instance, original, ghost, cull, castShadow } of this.materials) {
      instance.material = original;
      instance.cull = cull;
      instance.castShadow = castShadow;
      ghost.destroy();
    }
    this.materials.length = 0;
    if (wasActive) {
      this.owner.onGatewayArrival?.(false);
    }
  }
}
