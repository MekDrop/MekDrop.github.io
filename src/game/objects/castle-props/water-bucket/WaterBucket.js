import modelUrl from "../../../models/castle/props/wooden-water-bucket.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reusable wooden bucket with water contained inside its authored shell.
 */
export class WaterBucket extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Mesh}
   */
  #waterMesh;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #waterMaterial;

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const { pc } = options;
    const requested = options.definition.fillLevel ?? 0.65;
    const fill = Number.isFinite(requested) ? Math.min(1, Math.max(0, requested)) : 0.65;
    if (fill === 0) {
      return;
    }
    // Authored cavity: bottom Y=0.03, safe brim Y=0.21; radius tapers outward.
    const radius = 0.105 + fill * 0.012;
    const positions = [0, 0, 0];
    const normals = [0, 1, 0];
    const indices = [];
    for (let index = 0; index <= 48; index++) {
      const angle = index * Math.PI * 2 / 48;
      positions.push(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
      normals.push(0, 1, 0);
      if (index > 0) {
        indices.push(0, index, index + 1);
      }
    }
    this.#waterMesh = new pc.Mesh(pc.Application.getApplication().graphicsDevice);
    this.#waterMesh.setPositions(positions);
    this.#waterMesh.setNormals(normals);
    this.#waterMesh.setIndices(indices);
    this.#waterMesh.update();
    this.#waterMaterial = new pc.StandardMaterial();
    this.#waterMaterial.diffuse.set(0.07, 0.3, 0.38);
    this.#waterMaterial.specular.set(0.7, 0.85, 0.9);
    this.#waterMaterial.gloss = 0.88;
    this.#waterMaterial.update();
    const water = new pc.Entity(`${options.definition.id} water`);
    water.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.#waterMesh, this.#waterMaterial, water)],
      castShadows: false,
    });
    water.setLocalPosition(0, 0.03 + fill * 0.18, 0);
    // Inherit shell scaling and island movement without adding solid water collision.
    this.visualRoots[0].children[0].addChild(water);
  }

  destroy() {
    super.destroy();
    this.#waterMesh?.destroy();
    this.#waterMaterial?.destroy();
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
