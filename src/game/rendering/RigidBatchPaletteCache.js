const installed = new WeakSet();

/**
 * Keeps a rigid batch's GPU palette until one of its world transforms changes.
 * Only engine-generated dynamic batches use this; authored character skins do not.
 * @param {import("playcanvas").Batch} batch
 */
export function cacheRigidBatchPalette(batch) {
  const skin = batch.meshInstance?.skinInstance;
  if (!batch.dynamic || !skin || installed.has(skin)) {
    return;
  }
  installed.add(skin);
  let snapshot = null;
  let consecutiveChanges = 0;
  let bypassFrames = 0;
  const update = skin.updateMatrixPalette.bind(skin);
  skin.updateMatrixPalette = /**
   * @param {import("playcanvas").GraphNode} root
   * @param {number} index
   */
    (root, index) => {
      // Moving batches should not scan every matrix twice per frame.
      if (bypassFrames > 0) {
        bypassFrames--;
        update(root, index);

        return;
      }
      const probing = consecutiveChanges >= 2;
      const nodes = [root, ...skin.bones];
      let changed = !snapshot || snapshot.length !== nodes.length * 16;
      if (changed) {
        snapshot = new Float32Array(nodes.length * 16);
      }
      for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const matrix = nodes[nodeIndex].getWorldTransform().data;
        const offset = nodeIndex * 16;
        for (let component = 0; component < 16; component++) {
          if (snapshot[offset + component] !== matrix[component]) {
            changed = true;
          }
          snapshot[offset + component] = matrix[component];
        }
      }
      if (changed || probing) {
        update(root, index);
      }
      consecutiveChanges = changed ? consecutiveChanges + 1 : 0;
      if (consecutiveChanges >= 2) {
        bypassFrames = 29;
      }
    };
}
