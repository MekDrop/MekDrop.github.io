/**
 * Collapses a rigid imported hierarchy before it joins the moving-object batches.
 */
export class RigidModelBatch {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} model
   */
  static merge(pc, app, model) {
    const renders = model.findComponents("render").filter(RigidModelBatch.#enabled);
    if (renders.length < 2 || model.findComponents("anim").length || model.findComponents("animation").length || model.findComponents("light").length || model.findComponents("script").length) {
      return;
    }
    const meshes = renders.flatMap(RigidModelBatch.#meshes);
    const unsupported = meshes.some(/**
     *
     * @param {import("playcanvas").MeshInstance} mesh
     */
      (mesh) => !(mesh.material instanceof pc.StandardMaterial) || mesh.skinInstance || mesh.morphInstance || mesh.instancingData || mesh.mesh.vertexBuffer.usage !== pc.BUFFER_STATIC || mesh.material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).has("transformVS") || mesh.material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).has("transformCoreVS"));
    if (unsupported) {
      return;
    }
    const parent = model.parent;
    const index = parent.children.indexOf(model);
    const output = new pc.Entity(`${model.name} rigid visual`);
    // Bake in the owner's local space. Removing a node does not invalidate the
    // engine's cached world matrix, so explicitly dirty its unchanged local pose.
    parent.removeChild(model);
    model.setLocalPosition(model.getLocalPosition());
    const builder = new pc.BatchManager(app.graphicsDevice, model, app.scene);
    try {
      for (const group of builder.prepare(meshes, false, Infinity, true)) {
        const batch = builder.create(group, false);
        if (!batch) {
          continue;
        }
        const source = group[0];
        const part = new pc.Entity(`${source.node.name} merged`);
        output.addChild(part);
        const instance = new pc.MeshInstance(batch.meshInstance.mesh, batch.meshInstance.material, part);
        instance.castShadow = source.castShadow;
        instance.receiveShadow = source.receiveShadow;
        instance.cull = source.cull;
        instance.mask = source.mask;
        instance.drawOrder = source.drawOrder;
        instance.parameters = source.parameters;
        instance.stencilFront = source.stencilFront;
        instance.stencilBack = source.stencilBack;
        part.addComponent("render", {
          meshInstances: [instance],
          castShadows: source.castShadow,
          receiveShadows: source.receiveShadow,
          layers: renders[0].layers,
        });
        batch.meshInstance.destroy();
      }
      model.enabled = false;
      parent.insertChild(model, index);
      parent.addChild(output);
    } finally {
      builder.destroy();
      if (!model.parent) {
        parent.insertChild(model, index);
        output.destroy();
      }
    }
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   * @returns {boolean}
   */
  static #enabled(render) {
    return render.enabled && render.entity.enabled;
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   * @returns {import("playcanvas").MeshInstance[]}
   */
  static #meshes(render) {
    return render.meshInstances;
  }
}
