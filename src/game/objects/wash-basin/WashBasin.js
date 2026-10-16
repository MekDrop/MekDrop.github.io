import modelUrl from "../../models/castle/props/wooden-wash-basin.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Hollow wooden wash basin, placed with a shallow filling of water.
 */
export class WashBasin extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Mesh}
   */
  #waterMesh;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #waterMaterial;

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    const { pc, app } = options;
    // The authored interior tapers from radius 0.18 to 0.23 below its 0.205m rim.
    // Keep the surface inside the staves and below the upper retaining hoop.
    const positions = [0, 0, 0];
    const normals = [0, 1, 0];
    const indices = [];
    const segments = 64;
    for (let index = 0; index <= segments; index++) {
      const angle = index / segments * Math.PI * 2;
      positions.push(Math.cos(angle) * 0.218, 0, Math.sin(angle) * 0.218);
      normals.push(0, 1, 0);
      if (index < segments) { indices.push(0, index + 2, index + 1); }
    }
    this.#waterMesh = new pc.Mesh(app.graphicsDevice);
    this.#waterMesh.setPositions(positions);
    this.#waterMesh.setNormals(normals);
    this.#waterMesh.setIndices(indices);
    this.#waterMesh.update(pc.PRIMITIVE_TRIANGLES);
    this.#waterMaterial = new pc.StandardMaterial();
    this.#waterMaterial.diffuse.set(0.16, 0.43, 0.5);
    this.#waterMaterial.specular.set(0.8, 0.9, 0.95);
    this.#waterMaterial.shininess = 110;
    this.#waterMaterial.opacity = 0.82;
    this.#waterMaterial.blendType = pc.BLEND_NORMAL;
    this.#waterMaterial.update();
    const water = new pc.Entity("Wash basin water");
    water.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.#waterMesh, this.#waterMaterial)],
      castShadows: false,
    });
    water.setLocalPosition(0, 0.145, 0);
    // Parenting under the model preserves map-authored scale, stretch and tilt.
    this.visualRoots[0].children[0].addChild(water);
  }

  destroy() {
    super.destroy();
    this.#waterMesh.destroy();
    this.#waterMaterial.destroy();
  }
}
