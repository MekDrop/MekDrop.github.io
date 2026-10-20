import { cacheRigidBatchPalette } from "./RigidBatchPaletteCache.js";
import { cacheRigidBatchBounds } from "./RigidBatchBoundsCache.js";

/**
 * Batches rigid mesh parts while retaining their individual transforms and visibility.
 */
export class DynamicRenderBatch {
  /**
   * @type {WeakMap<import("playcanvas").Application, Map<string, {id: number, members: number, handle?: import("playcanvas").EventHandle}>>}
   */
  static #groups = new WeakMap();
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {string}
   */
  #groupKey;
  /**
   * @type {number|null}
   */
  #groupId = null;
  /**
   * @type {import("playcanvas").RenderComponent[]}
   */
  #renders = [];

  /**
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} root
   * @param {number} staticBufferUsage
   * @param {boolean} dynamic Whether member transforms can move after batching.
   * @param {string} category Separates independently animated members from other props.
   */
  constructor(app, root, staticBufferUsage, dynamic = true, category = "default") {
    this.#app = app;
    this.#groupKey = `${dynamic}:${category}`;
    if (!app.batcher) {
      return;
    }
    let groups = DynamicRenderBatch.#groups.get(app);
    if (!groups) {
      groups = new Map();
      DynamicRenderBatch.#groups.set(app, groups);
    }
    let group = groups.get(this.#groupKey);
    if (!group) {
      const batchGroup = app.batcher.addGroup(`${DynamicRenderBatch.name}-${this.#groupKey}`, dynamic, 32);
      group = {
        id: batchGroup.id,
        members: 0,
      };
      if (dynamic) {
        group.handle = app.on?.("prerender", /**
         * Installs on newly generated batches after membership changes, too.
         */
          () => {
            for (const batch of app.batcher.getBatches?.(batchGroup.id) ?? []) {
              cacheRigidBatchPalette(batch);
              cacheRigidBatchBounds(batch);
            }
          });
      }
      groups.set(this.#groupKey, group);
    }
    this.#groupId = group.id;
    group.members += 1;
    for (const render of root.findComponents("render")) {
      // Skinning, instancing and CPU-deformed cloth already own their vertex updates.
      /**
       * @param {import("playcanvas").MeshInstance} mesh
       */
      const isStaticBatchableMesh = (mesh) => !mesh.skinInstance && !mesh.morphInstance &&
          !mesh.instancingData && mesh.mesh.vertexBuffer.usage === staticBufferUsage;
      if (render.enabled && render.batchGroupId < 0 && render.meshInstances.every(isStaticBatchableMesh)) {
        render.batchGroupId = group.id;
        this.#renders.push(render);
      }
    }
    // Generate once after all scene objects have joined. The engine separates
    // incompatible materials and keeps spatial bounds at the 32m patch size.
    app.batcher.markGroupDirty(group.id);
  }

  destroy() {
    if (this.#groupId !== null) {
      for (const render of this.#renders) {
        if (render.batchGroupId === this.#groupId) {
          render.batchGroupId = -1;
        }
      }
      this.#renders = [];
      const groups = DynamicRenderBatch.#groups.get(this.#app);
      const group = groups?.get(this.#groupKey);
      if (group && --group.members === 0) {
        group.handle?.off();
        this.#app.batcher?.removeGroup(group.id);
        groups.delete(this.#groupKey);
        if (!groups.size) {
          DynamicRenderBatch.#groups.delete(this.#app);
        }
      } else {
        this.#app.batcher?.markGroupDirty(this.#groupId);
      }
      this.#groupId = null;
    }
  }
}
