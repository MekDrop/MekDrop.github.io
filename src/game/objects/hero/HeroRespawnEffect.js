import contourFragmentShader from "./HeroRespawnContour.frag?raw";
import contourVertexShader from "./HeroRespawnContour.vert?raw";

const CONTOUR_SCALE = 1.018;
const RECONSTRUCTION_HEIGHT = 1.65;
const SOLID_FADE_START = 0.12;
const SOLID_FADE_END = 0.82;

export class HeroRespawnEffect {
  #pc;
  #modelRoot;
  #outlineRoot;
  #contourMaterial;
  #solidMeshes = [];
  #fadeMaterials = new Map();
  #modelScale;
  #startHeight;

  constructor({
    pc,
    parent,
    modelRoot,
    modelLibrary,
    modelUrl,
    modelScale,
    startHeight,
    respawnAnimation,
  }) {
    this.#pc = pc;
    this.#modelRoot = modelRoot;
    this.#modelScale = modelScale;
    this.#startHeight = startHeight;
    this.#collectSolidMeshes();

    this.#contourMaterial = new pc.ShaderMaterial({
      uniqueName: "hero-respawn-contour",
      vertexGLSL: contourVertexShader,
      fragmentGLSL: contourFragmentShader,
      attributes: {
        vertex_position: pc.SEMANTIC_POSITION,
      },
    });
    this.#contourMaterial.name = "Hero respawn contour shader";
    this.#contourMaterial.blendType = pc.BLEND_ADDITIVEALPHA;
    this.#contourMaterial.depthWrite = false;
    this.#contourMaterial.cull = pc.CULLFACE_NONE;
    this.#contourMaterial.setParameter("uTime", 0);
    this.#contourMaterial.setParameter("uReveal", 0);
    this.#contourMaterial.setParameter("uBaseHeight", 0);
    this.#contourMaterial.setParameter("uHeroHeight", RECONSTRUCTION_HEIGHT);
    this.#contourMaterial.update();

    this.#outlineRoot = modelLibrary.instantiate(modelUrl);
    this.#outlineRoot.name = "Hero respawn contour";
    this.#configureOutlineMeshes();
    this.#hideNamedEntity(this.#outlineRoot, "Hero axe");
    this.#outlineRoot.addComponent("anim", { activate: true });
    this.#outlineRoot.anim.addAnimationState(
      "Respawn",
      respawnAnimation,
      1,
      false,
    );
    this.#outlineRoot.enabled = false;
    parent.addChild(this.#outlineRoot);
  }

  begin(facingYaw, baseHeight) {
    this.#outlineRoot.enabled = true;
    this.#outlineRoot.setLocalEulerAngles(0, facingYaw, 0);
    this.#outlineRoot.anim.baseLayer.play("Respawn");
    this.update(0, 0, baseHeight);
  }

  setFacingYaw(facingYaw) {
    this.#outlineRoot?.setLocalEulerAngles(0, facingYaw, 0);
  }

  update(progress, elapsed, baseHeight) {
    const reconstruction = this.#smoothStep(
      Math.min(1, progress / 0.68),
    );
    const descent = this.#smoothStep(
      Math.max(0, Math.min(1, (progress - 0.68) / 0.32)),
    );
    const height = this.#startHeight * (1 - descent);
    const solidProgress = this.#smoothStep(
      Math.max(
        0,
        Math.min(
          1,
          (reconstruction - SOLID_FADE_START) /
            (SOLID_FADE_END - SOLID_FADE_START),
        ),
      ),
    );

    this.#modelRoot.setLocalPosition(0, height, 0);
    this.#modelRoot.setLocalScale(
      this.#modelScale,
      this.#modelScale,
      this.#modelScale,
    );
    this.#outlineRoot.setLocalPosition(0, height, 0);
    const contourScale = this.#modelScale * CONTOUR_SCALE;
    this.#outlineRoot.setLocalScale(
      contourScale,
      contourScale,
      contourScale,
    );
    this.#setSolidOpacity(solidProgress);
    this.#contourMaterial.setParameter("uTime", elapsed);
    this.#contourMaterial.setParameter("uReveal", reconstruction);
    this.#contourMaterial.setParameter(
      "uBaseHeight",
      baseHeight + height,
    );
  }

  reset() {
    if (!this.#modelRoot) {
      return;
    }
    this.#modelRoot.setLocalPosition(0, 0, 0);
    this.#modelRoot.setLocalScale(
      this.#modelScale,
      this.#modelScale,
      this.#modelScale,
    );
    for (const item of this.#solidMeshes) {
      item.meshInstance.material = item.originalMaterial;
      item.meshInstance.castShadow = item.castShadow;
      item.meshInstance.receiveShadow = item.receiveShadow;
    }
    if (this.#outlineRoot) this.#outlineRoot.enabled = false;
  }

  destroy() {
    this.reset();
    this.#outlineRoot?.destroy();
    this.#outlineRoot = null;
    this.#contourMaterial?.destroy();
    this.#contourMaterial = null;
    for (const material of this.#fadeMaterials.values()) material.destroy();
    this.#fadeMaterials.clear();
    this.#solidMeshes = [];
    this.#modelRoot = null;
  }

  #collectSolidMeshes() {
    this.#forEachMesh(this.#modelRoot, (meshInstance) => {
      const originalMaterial = meshInstance.material;
      let fadeMaterial = this.#fadeMaterials.get(originalMaterial);
      if (!fadeMaterial) {
        fadeMaterial = originalMaterial.clone();
        fadeMaterial.name = `${originalMaterial.name} respawn fade`;
        fadeMaterial.blendType = this.#pc.BLEND_NORMAL;
        fadeMaterial.depthWrite = false;
        fadeMaterial.opacity = 0;
        fadeMaterial.update();
        this.#fadeMaterials.set(originalMaterial, fadeMaterial);
      }
      this.#solidMeshes.push({
        meshInstance,
        originalMaterial,
        fadeMaterial,
        castShadow: meshInstance.castShadow,
        receiveShadow: meshInstance.receiveShadow,
      });
    });
  }

  #configureOutlineMeshes() {
    this.#forEachMesh(this.#outlineRoot, (meshInstance) => {
      meshInstance.material = this.#contourMaterial;
      meshInstance.renderStyle = this.#pc.RENDERSTYLE_WIREFRAME;
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = false;
      meshInstance.pick = false;
    });
  }

  #setSolidOpacity(opacity) {
    for (const material of this.#fadeMaterials.values()) {
      material.opacity = opacity;
      material.update();
    }
    for (const item of this.#solidMeshes) {
      item.meshInstance.material = item.fadeMaterial;
      item.meshInstance.castShadow = false;
      item.meshInstance.receiveShadow = false;
    }
  }

  #forEachMesh(root, callback) {
    const pending = [root];
    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        callback(meshInstance);
      }
      pending.push(...entity.children);
    }
  }

  #hideNamedEntity(root, name) {
    const pending = [root];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.name === name) {
        entity.enabled = false;
        return;
      }
      pending.push(...entity.children);
    }
  }

  #smoothStep(value) {
    return value * value * (3 - 2 * value);
  }
}
