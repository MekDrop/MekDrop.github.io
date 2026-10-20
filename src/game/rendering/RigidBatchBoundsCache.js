const installed = new WeakSet();

/**
 * Reuses rigid batch bounds while member transforms and mesh bounds are unchanged.
 * @param {import("playcanvas").Batch} batch
 */
export function cacheRigidBatchBounds(batch) {
  if (!batch.dynamic || installed.has(batch)) {
    return;
  }
  installed.add(batch);
  let snapshot = null;
  let consecutiveChanges = 0;
  let bypassFrames = 0;
  const update = batch.updateBoundingBox.bind(batch);
  batch.updateBoundingBox = /**
   * Updates immediately when any member moves, scales, or changes geometry.
   */
    () => {
      // Moving batches should not scan every matrix twice per frame.
      if (bypassFrames > 0) {
        bypassFrames--;
        update();

        return;
      }
      const probing = consecutiveChanges >= 2;
      const meshes = batch.origMeshInstances;
      let changed = !snapshot || snapshot.length !== meshes.length * 22;
      // Mesh bounds are JavaScript doubles, even when matrices use float32.
      // Truncating them would make unchanged fractional bounds appear dirty.
      if (changed) {
        snapshot = new Float64Array(meshes.length * 22);
      }
      for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
        const mesh = meshes[meshIndex];
        const matrix = mesh.node.getWorldTransform().data;
        const offset = meshIndex * 22;
        for (let component = 0; component < 16; component++) {
          if (snapshot[offset + component] !== matrix[component]) {
            changed = true;
          }
          snapshot[offset + component] = matrix[component];
        }
        const bounds = mesh.mesh.aabb;
        for (let component = 0; component < 6; component++) {
          const vector = component < 3 ? bounds.center : bounds.halfExtents;
          const axis = component % 3;
          const value = axis === 0 ? vector.x : axis === 1 ? vector.y : vector.z;
          if (snapshot[offset + 16 + component] !== value) {
            changed = true;
          }
          snapshot[offset + 16 + component] = value;
        }
      }
      if (changed || probing) {
        update();
      }
      consecutiveChanges = changed ? consecutiveChanges + 1 : 0;
      if (consecutiveChanges >= 2) {
        bypassFrames = 29;
      }
    };
}
