/**
 * Batches rigid mesh parts while retaining their individual transforms and visibility.
 */
export class DynamicRenderBatch {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {number|null}
   */
  #groupId = null;

  /**
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} root
   * @param {number} staticBufferUsage
   */
  constructor(app, root, staticBufferUsage) {
    this.#app = app;
    if (!app.batcher) {
      return;
    }
    const group = app.batcher.addGroup(root.name, true, 16);
    this.#groupId = group.id;
    for (const render of root.findComponents("render")) {
      // Skinning, instancing and CPU-deformed cloth already own their vertex updates.
      if (render.enabled && render.meshInstances.every(
        /**
         * @param {import("playcanvas").MeshInstance} mesh
         */
        (mesh) => !mesh.skinInstance && !mesh.morphInstance &&
          !mesh.instancingData && mesh.mesh.vertexBuffer.usage === staticBufferUsage,
      )) {
        render.batchGroupId = group.id;
      }
    }
    app.batcher.generate([group.id]);
  }

  destroy() {
    if (this.#groupId !== null) {
      this.#app.batcher?.removeGroup(this.#groupId);
      this.#groupId = null;
    }
  }
}
