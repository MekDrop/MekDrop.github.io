import { rugModels } from "./RugModels.js";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Floor covering with an optional fabric image URL and inherited weathering.
 * Omit texture to keep the model's default woven fabric.
 */
export class Rug extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Asset|null}
   */
  #textureAsset = null;
  /**
   * @type {import("playcanvas").Application|null}
   */
  #app = null;
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0] & {app?: import("playcanvas").Application}} options
   */
  constructor(options) {
    super(options);

    const { pc, definition } = options;
    if (!definition.texture) { return; }
    this.#app = options.app ?? pc.Application.getApplication();
    /**
     * @type {import("playcanvas").StandardMaterial[]}
     */
    const materials = [];
    for (const render of this.visualRoots[0].findComponents("render")) {
      const instances = [];
      for (const mesh of render.meshInstances) {
        const geometry = this.#textureGeometry(pc, mesh);
        const material = this.cloneMaterial(mesh.material);
        material.diffuseMapUv = 1;
        instances.push(new pc.MeshInstance(geometry, material, mesh.node));
        materials.push(material);
      }
      render.meshInstances = instances;
    }
    this.#textureAsset = new pc.Asset(
      definition.id + " rug fabric", "texture", { url: definition.texture },
    );
    this.#textureAsset.once("load", /**
     * @param {import("playcanvas").Asset} asset
     */ (asset) => {
        for (const material of materials) {
          material.diffuseMap = asset.resource;
          material.update();
        }
      });
    this.#app.assets.add(this.#textureAsset);
    this.#app.assets.load(this.#textureAsset);
  }
  /**
   * Keep imported weave normals on UV0; map the replacement fabric across UV1.
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {import("playcanvas").Mesh}
   */
  #textureGeometry(pc, instance) {
    const source = instance.mesh;
    const positions = [], normals = [], tangents = [], uvs = [], indices = [];
    source.getPositions(positions);
    source.getNormals(normals);
    source.getVertexStream(pc.SEMANTIC_TANGENT, tangents);
    source.getUvs(0, uvs);
    source.getIndices(indices);
    const min = source.aabb.getMin();
    const size = source.aabb.halfExtents.clone().mulScalar(2);
    const uvs1 = [];
    for (let index = 0; index < positions.length; index += 3) {
      uvs1.push((positions[index] - min.x) / size.x, (positions[index + 2] - min.z) / size.z);
    }

    return pc.Mesh.fromGeometry(source.device, {
      positions,
      normals,
      ...(tangents.length ? { tangents } : {}),
      uvs,
      uvs1,
      indices,
    });
  }
  /**
   * Preserve requested floor dimensions independently of the default mesh size.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (this.definition.model) { return; }
    const { width, depth, scale = 1 } = this.definition;
    const size = model.getLocalScale();
    model.setLocalScale(width === undefined ? size.x : width * scale / 1.2,
      size.y, depth === undefined ? size.z : depth * scale / 0.75);
  }
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return Object.values(rugModels); }
  /**
   * @returns {string}
   */
  get modelUrl() {
    return rugModels["../../models/rug/" + (this.definition.model ?? "woven-rug.glb")];
  }
  /**
   * Cloth relies on the floor for support and must not obstruct door contacts.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return false; }
  destroy() {
    if (this.#textureAsset) {
      this.#textureAsset.off();
      this.#app.assets.remove(this.#textureAsset);
      this.#textureAsset.unload();
      this.#textureAsset = null;
    }
    super.destroy();
  }
}
