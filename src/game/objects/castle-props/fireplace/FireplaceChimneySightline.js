import { CastleResidentialLayout } from "../../castle/residents/CastleResidentialLayout.js";

/**
 * Opens the fireplace flue through castle surface materials.
 */
export class FireplaceChimneySightline {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} root
   * @param {import("../../../GameContracts.js").CastleBuildPlan} buildPlan
   */
  static add(pc, app, root, buildPlan) {
    const plan = buildPlan.metadata.runtime.residential;
    const layout = new CastleResidentialLayout(buildPlan);
    const flues = plan.furniture.filter(FireplaceChimneySightline.#filterItem).map(
      /**
       * @param {import("../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem} item
       * @returns {import("playcanvas").Mat4}
       */ item => {
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y);
        const rotation = new pc.Quat().setFromEulerAngles(0, layout.yaw + 180 + (item.rotation ?? 0), 0);

        return new pc.Mat4().setTRS(new pc.Vec3(position.x, position.y, position.z), rotation, new pc.Vec3(1, 1, 1));
      },
    );
    if (!flues.length) {
      return;
    }
    const materials = new Map();
    for (const render of root.findComponents("render")) {
      for (const instance of render.meshInstances) {
        const original = instance.material;
        if (!materials.has(original)) {
          const material = original.clone();
          material.alphaTest = Math.max(material.alphaTest ?? 0, 0.001);
          for (const language of [pc.SHADERLANGUAGE_GLSL, pc.SHADERLANGUAGE_WGSL]) {
            const wgsl = language === pc.SHADERLANGUAGE_WGSL;
            const chunks = material.getShaderChunks(language);
            let declarations = chunks.get("litUserDeclarationVS") ?? "";
            let vertex = chunks.get("litUserMainEndVS") ?? "";
            let fragment = "";
            let cuts = "";
            for (let index = 0; index < flues.length; index++) {
              const name = `vChimney${index}`;
              declarations += wgsl ? `\nuniform uChimney${index}: mat4x4f; varying ${name}: vec3f;`
                : `\nuniform mat4 uChimney${index}; varying vec3 ${name};`;
              vertex += wgsl ? `\noutput.${name} = (uniform.uChimney${index} * uniform.matrix_model * vec4f(vertex_position.xyz, 1.0)).xyz;`
                : `\n${name} = (uChimney${index} * matrix_model * vec4(vertex_position.xyz, 1.0)).xyz;`;
              fragment += wgsl ? `\nvarying ${name}: vec3f;` : `\nvarying vec3 ${name};`;
              const p = name;
              // Clear the complete stone course footprint, not just its bore.
              // Roof tiles behind the rounded inner walls show at oblique angles.
              cuts += `\nif (abs(${p}.x - 0.028) < 0.30 && abs(${p}.z + 0.2073) < 0.21 && ${p}.y > 0.32) { discard; }`;
            }
            chunks.set("litUserDeclarationVS", declarations);
            chunks.set("litUserMainEndVS", vertex);
            const opacity = chunks.get("opacityPS") ?? pc.ShaderChunks.get(app.graphicsDevice, language).get("opacityPS");
            const end = opacity.lastIndexOf("}");
            chunks.set("opacityPS", `${fragment}\n${opacity.slice(0, end)}${cuts}\n${opacity.slice(end)}`);
          }
          material.update();
          materials.set(original, material);
        }
        instance.material = materials.get(original);
      }
    }
    /**
     * Update the flue transform with island motion.
     */
    const update = () => {
      flues.forEach(/**
       * @param {import("playcanvas").Mat4} bind
       * @param {number} index
       */ (bind, index) => {
          const inverse = new pc.Mat4().mul2(root.getWorldTransform(), bind).invert();
          for (const material of materials.values()) {
            material.setParameter(`uChimney${index}`, inverse.data);
          }
        });
    };
    update();
    const handle = app.on("update", update);
    root.once("destroy", () => {
      handle.off();
      for (const material of materials.values()) {
        material.destroy();
      }
    });
  }

  /**
   * @param {import("../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem} item
   * @returns {boolean}
   */
  static #filterItem(item) {
    return item.object === "Fireplace";
  }
}
