import modelUrl from "../../models/castle/props/kitchen-fireplace.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { CastleFire } from "../castle/CastleFire.js";
import fireGLSL from "./KitchenFire.glsl?raw";
import fireWGSL from "./KitchenFire.wgsl?raw";
import chimneyModelUrl from "../../models/castle/props/kitchen-chimney-course.glb?url";

/**
 * Authored kitchen fireplace placed through the map objects array.
 */
export class KitchenFireplace extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").StandardMaterial[]}
   */
  #materials = [];
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #chimney = null;
  /**
   * @type {CastleFire|null}
   */
  #fire = null;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    super(options);
    const { pc, app, definition } = options;
    const root = this.visualRoots[0];
    for (const render of root.findComponents("render")) {
      for (const instance of render.meshInstances) {
        const material = instance.material.clone();
        material.name = "Animated kitchen hearth";
        material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
        for (const [language, fire] of [
          [pc.SHADERLANGUAGE_GLSL, fireGLSL],
          [pc.SHADERLANGUAGE_WGSL, fireWGSL],
        ]) {
          const wgsl = language === pc.SHADERLANGUAGE_WGSL;
          const stock = pc.ShaderChunks.get(app.graphicsDevice, language);
          const chunks = material.getShaderChunks(language);
          const varying = wgsl
            ? "varying vHearthPosition: vec3f;"
            : "varying vec3 vHearthPosition;";
          chunks.set("litUserDeclarationVS", varying);
          chunks.set("litUserMainEndVS", wgsl
            ? "output.vHearthPosition = vertex_position.xyz;"
            : "vHearthPosition = vertex_position.xyz;",
          );
          const diffuse = stock.get("diffusePS");
          const close = diffuse.lastIndexOf("}");
          const declaration = wgsl ? "let" : "vec4";
          const vector = wgsl ? "vec3f" : "vec3";
          // Erase the painted flame before adding emission, retaining the
          // imported material's lighting and texture outside the firebox.
          chunks.set("diffusePS", `${fire}
${diffuse.slice(0, close)}
  ${declaration} hearth = hearthFire();
  dAlbedo = mix(dAlbedo, ${vector}(0.012, 0.006, 0.003), hearth.a);
${diffuse.slice(close)}`);
          chunks.set("emissivePS", `${wgsl ? "fn" : "void"} getEmission() {
  ${declaration} hearth = hearthFire();
  dEmission = ${vector}(0.0);
}`);
        }
        material.setParameter("uHearthTime", 0);
        material.update();
        instance.material = material;
        this.#materials.push(material);
      }
    }
    // Keep full stone courses at their authored proportions. Only the final
    // course is shortened to meet the local roof surface exactly.
    const scale = definition.scale ?? 1;
    // Reuse the brazier flames in three spatially separated hearth pockets.
    // The shader only removes the model's baked fire; particles own the flame.
    this.#fire = new CastleFire({ pc, app, modelLibrary: options.modelLibrary,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource });
    for (const x of [-0.16, 0, 0.16]) {
      this.#fire.add({ x, y: 0.29, z: -0.04, scale: 0.12, brazier: false, intensity: 0 });
    }
    this.#fire.add({ x: 0.028, y: 0.29, z: -0.2073, scale: 0.075, brazier: false, intensity: 0.15 });
    root.children[0].addChild(this.#fire.entity);
    const top = definition.chimneyHeight ?? 1.65 * scale;
    const courseHeight = 0.24 * scale;
    this.#chimney = new pc.Entity("Kitchen chimney");
    root.addChild(this.#chimney);
    for (let bottom = 1.65 * scale, index = 0; bottom < top; bottom += courseHeight, index++) {
      const course = options.modelLibrary.instantiate(chimneyModelUrl);
      course.name = `Kitchen chimney course ${index}`;
      course.setLocalPosition(0.028 * scale, bottom, -0.2073 * scale);
      course.setLocalEulerAngles(0, index % 2 * 180, 0);
      course.setLocalScale(scale, Math.min(courseHeight, top - bottom) / 0.24, scale);
      this.#chimney.addChild(course);
    }
    if (top > 1.65 * scale) {
      const height = top - 1.65 * scale;
      this.#chimney.addComponent("collision", {
        type: "box",
        halfExtents: new pc.Vec3(0.29 * scale, height / 2, 0.2 * scale),
        linearOffset: new pc.Vec3(0.028 * scale, 1.65 * scale + height / 2, -0.2073 * scale),
      });
      this.#chimney.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    }
    const glow = new pc.Entity("Kitchen hearth glow");
    glow.setLocalPosition(0, 0.55 * scale, 0.24 * scale);
    glow.addComponent("light", {
      type: "omni",
      color: new pc.Color(1, 0.29, 0.045),
      range: 2.5 * scale,
      intensity: 1.4,
      castShadows: false,
    });
    root.addChild(glow);
    this.#elapsed = definition.position.x * 0.73 + definition.position.z * 1.19;
    this.#updateHandle = app.on("update",
      /**
       * @param {number} deltaTime
       */
      (deltaTime) => this.#animate(deltaTime, glow),
    );
  }

  /**
   * @param {number} deltaTime
   * @param {import("playcanvas").Entity} glow
   */
  #animate(deltaTime, glow) {
    this.#elapsed += deltaTime;
    // Only uniforms change each frame; compiled shader variants remain cached.
    for (const material of this.#materials) {
      material.setParameter("uHearthTime", this.#elapsed);
    }
    glow.light.intensity = 1.35 + Math.sin(this.#elapsed * 11.1) * 0.2 +
      Math.sin(this.#elapsed * 4.7) * 0.13;
  }
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [modelUrl, chimneyModelUrl];
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    super.setIslandOffsets(near, far, offsets);
    this.#chimney.rigidbody?.syncEntityToBody();
  }

  destroy() {
    this.#fire?.destroy();
    this.#fire = null;
    this.#updateHandle?.off();
    this.#updateHandle = null;
    super.destroy();
    this.#chimney = null;
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#materials = [];
  }
}
