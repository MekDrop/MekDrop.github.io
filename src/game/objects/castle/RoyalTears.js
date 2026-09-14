import vertexShader from "./RoyalTears.vert?raw";
import fragmentShader from "./RoyalTears.frag?raw";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";

/** Small procedural tear particles following the imported character's face. */
export class RoyalTears {
  #royal;
  #mesh;
  #particles = [];
  #materials = [];
  #updateHandle;
  #princess;
  #cryElapsed = 0;

  constructor({ pc, app, royal }) {
    this.#royal = royal;
    this.#princess = Boolean(royal.findByName("Princess handkerchief"));
    this.#mesh = new pc.Mesh(app.graphicsDevice);
    this.#mesh.setPositions([
      -0.06, 0, 0, 0.06, 0, 0,
      -0.06, -0.52, 0, 0.06, -0.52, 0,
    ]);
    this.#mesh.setUvs(0, [0, 0, 1, 0, 0, 1, 1, 1]);
    this.#mesh.setIndices([0, 2, 1, 1, 2, 3]);
    this.#mesh.update();
    this.#mesh.incRefCount();

    for (const [index, side] of ["left", "right"].entries()) {
      const originalTear = royal.findByName(`Royal tear ${side}`);
      for (const render of originalTear?.findComponents("render") ?? []) {
        render.enabled = false;
      }
      const eye = royal.findByName(`Royal ${side} eye`);
      const material = new pc.ShaderMaterial({
        uniqueName: "royal-cel-shaded-tears",
        vertexGLSL: vertexShader,
        fragmentGLSL: fragmentShader,
        attributes: {
          vertex_position: pc.SEMANTIC_POSITION,
          vertex_texCoord0: pc.SEMANTIC_TEXCOORD0,
        },
      });
      material.name = `Royal ${side} cel-shaded tears`;
      material.cull = pc.CULLFACE_NONE;
      material.setParameter("uTime", 0);
      material.setParameter("uPhase", index * 0.12);
      material.setParameter("uPrincess", this.#princess ? 1 : 0);
      material.setParameter("uWipeAt", side === "right" ? 0.29 : 0.54);
      material.setParameter("uRareDrop", 0);
      material.update();
      this.#materials.push(material);

      const particle = new pc.Entity(`Royal ${side} tear shader`);
      const surface = royal.findByName(`Royal ${side} tear surface`);
      // Authored anchors follow the faceted cheek directly below each eye.
      particle.setLocalPosition(surface.getLocalPosition());
      eye.parent.addChild(particle);
      const instance = new pc.MeshInstance(this.#mesh, material, particle);
      instance.castShadow = false;
      instance.receiveShadow = false;
      instance.pick = false;
      particle.addComponent("render", {
        meshInstances: [instance],
        castShadows: false,
        receiveShadows: false,
      });
      particle.enabled = false;
      this.#particles.push(particle);
    }
    this.#updateHandle = app.on("update", this.#update, this);
  }

  destroy() {
    this.#updateHandle?.off();
    for (const particle of this.#particles) {
      particle.destroy();
    }
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#mesh.decRefCount();
    if (this.#mesh.refCount < 1) {
      this.#mesh.destroy();
    }
    this.#particles = [];
    this.#materials = [];
  }

  #update(deltaTime) {
    const layer = this.#royal.anim.baseLayer;
    const crying = layer.activeState === ROYAL_ANIMATION.CRY;
    for (const particle of this.#particles) {
      particle.enabled = crying;
    }
    if (!crying) {
      this.#cryElapsed = 0;
      return;
    }
    if (this.#royal.anim.speed > 0) {
      this.#cryElapsed += deltaTime * this.#royal.anim.speed;
    }
    // One restrained drop per eye per authored loop; pauses stay in sync.
    const time = layer.activeStateCurrentTime / layer.activeStateDuration;
    const spill = Math.floor(this.#cryElapsed / layer.activeStateDuration) % 4 === 3;
    for (const [index, material] of this.#materials.entries()) {
      material.setParameter("uTime", time);
      // The princess usually catches her tears; only one eye spills every fourth loop.
      material.setParameter("uRareDrop", this.#princess && spill && index === 1 ? 1 : 0);
    }
  }
}
