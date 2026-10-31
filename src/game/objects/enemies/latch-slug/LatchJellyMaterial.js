import fieldGlsl from "./LatchJellyField.frag?raw";
import fieldWgsl from "./LatchJellyField.wgsl?raw";

/**
 * Advected cloudy gel inside the authored skin, driven by native body motion.
 */
export class LatchJellyMaterial {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.materials = new Map();
    this.instances = [];
    this.time = 0;
    this.landingAge = 10;
    this.wasAirborne = false;
    const { pc, app } = owner;
    this.inverse = new pc.Mat4();
    this.lag = new pc.Vec3();
    this.velocity = new pc.Vec3();
    this.motion = new Float32Array(4);
    const instances = model.findComponents("render").flatMap(LatchJellyMaterial.#meshes);
    const bounds = instances[0].aabb.clone();
    for (const instance of instances) {
      bounds.add(instance.aabb);
    }
    this.center = owner.entity.getWorldTransform().clone().invert().transformPoint(bounds.center);
    this.radius = bounds.halfExtents.clone();
    this.center.y -= this.radius.y * 0.33;
    this.radius.y *= 0.67;
    this.radius.x *= 0.87;
    this.radius.z *= 0.87;
    const color = new pc.Color(1, 0.76, 0.23).linear();
    this.cloudColor = [color.r, color.g, color.b];
    for (const instance of instances) {
      const source = instance.material;
      if (/eye|tip/i.test(source.name)) {
        continue;
      }
      let material = this.materials.get(source);
      if (!material) {
        material = source.clone();
        material.name = `${source.name} - living jelly`;
        // Keep the silhouette readable even when a cloudy region drifts away.
        material.opacity = 0.82;
        material.blendType = pc.BLEND_NORMAL;
        // The closed outer skin must occlude grass drawn in a later pass.
        material.depthWrite = true;
        material.cull = pc.CULLFACE_BACK;
        material.gloss = 0.76;
        material.clearCoat = 0.35;
        material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
        this.#configure(material, pc.SHADERLANGUAGE_GLSL, fieldGlsl);
        this.#configure(material, pc.SHADERLANGUAGE_WGSL, fieldWgsl);
        material.update();
        this.materials.set(source, material);
      }
      instance.material = material;
      this.instances.push({
        instance,
        source,
      });
    }
    this.handle = app.on("prerender", this.update, this);
    this.cameraHandle = app.scene.on(pc.EVENT_PRERENDER, this.#camera, this);
    this.updateHandle = app.on("update", this.#tick, this);
    this.update();
    this.#camera(owner.runtime.camera.component);
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   * @returns {import("playcanvas").MeshInstance[]}
   */
  static #meshes(render) {
    return render.meshInstances;
  }

  /**
   * @param {import("playcanvas").StandardMaterial} material
   * @param {string} language
   * @param {string} field
   */
  #configure(material, language, field) {
    const { pc, app } = this.owner;
    const wgsl = language === pc.SHADERLANGUAGE_WGSL;
    const declaration = wgsl ? "fn" : "void";
    const reference = pc.ShaderChunks.get(app.graphicsDevice, language);
    const opacity = reference.get("opacityPS").replace("getOpacity()", "getSkinOpacity()");
    const diffuse = reference.get("diffusePS").replace("getAlbedo()", "getSkinAlbedo()");
    const chunks = material.getShaderChunks(language);
    chunks.set("opacityPS", `${field}\n${opacity}\n${declaration} getOpacity() { getSkinOpacity(); dAlpha = min(0.97, dAlpha * (1.0 + 0.18 * latchJellyDensity())); }`);
    chunks.set("diffusePS", `${field}\n${diffuse}\n${declaration} getAlbedo() { getSkinAlbedo(); dAlbedo = mix(dAlbedo, ${wgsl ? "uniform." : ""}uJellyCloudColor, latchJellyDensity() * 0.58); }`);
  }

  /**
   * @param {number} dt
   */
  #tick(dt) {
    this.time += dt;
    const { owner } = this;
    if (this.wasAirborne && !owner.airborne) {
      this.landingAge = 0;
    } else {
      this.landingAge += dt;
    }
    this.wasAirborne = owner.airborne;
    const velocity = owner.entity.rigidbody?.linearVelocity;
    if (velocity) {
      this.inverse.invert(owner.entity.getWorldTransform());
      this.inverse.transformVector(velocity, this.velocity);
      // A bounded visual low-pass filter, not a replacement physics integrator.
      const blend = 1 - Math.exp(-dt * 4.5);
      this.lag.x += (Math.max(-0.11, Math.min(0.11, -this.velocity.x * 0.07)) - this.lag.x) * blend;
      this.lag.y += (Math.max(-0.09, Math.min(0.09, -this.velocity.y * 0.025)) - this.lag.y) * blend;
      this.lag.z += (Math.max(-0.11, Math.min(0.11, -this.velocity.z * 0.07)) - this.lag.z) * blend;
    }
  }

  update() {
    this.inverse.invert(this.owner.entity.getWorldTransform());
    this.motion[0] = this.time * 0.5;
    this.motion[1] = Math.cos(this.landingAge * 15) * Math.exp(-this.landingAge * 5);
    for (const { instance } of this.instances) {
      // Mesh parameters survive the gate's temporary material clones.
      instance.setParameter("uWorldToJelly", this.inverse.data);
      instance.setParameter("uJellyCenter", [this.center.x, this.center.y, this.center.z]);
      instance.setParameter("uJellyRadius", [this.radius.x, this.radius.y, this.radius.z]);
      instance.setParameter("uJellyMotion", this.motion);
      instance.setParameter("uJellyLag", [this.lag.x, this.lag.y, this.lag.z]);
      instance.setParameter("uJellyCloudColor", this.cloudColor);
    }
  }

  /**
   * @param {import("playcanvas").CameraComponent} camera
   */
  #camera(camera) {
    const position = camera.entity.getPosition();
    for (const { instance } of this.instances) {
      instance.setParameter("uJellyView", [position.x, position.y, position.z]);
    }
  }

  destroy() {
    this.handle.off();
    this.cameraHandle.off();
    this.updateHandle.off();
    for (const { instance, source } of this.instances) {
      instance.material = source;
    }
    for (const material of this.materials.values()) {
      material.destroy();
    }
    this.materials.clear();
  }
}
