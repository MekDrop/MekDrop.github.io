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
  let previousNodes = [];
  let versions = [];
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
      const count = skin.bones.length + 1;
      let changed = !snapshot || snapshot.length !== count * 16;
      if (changed) {
        snapshot = new Float32Array(count * 16);
        previousNodes = new Array(count);
        versions = new Array(count);
      }
      for (let nodeIndex = 0; nodeIndex < count; nodeIndex++) {
        const node = nodeIndex === 0 ? root : skin.bones[nodeIndex - 1];
        // GraphNode increments this version whenever it or an ancestor is
        // dirtied. Unchanged nodes need neither matrix synchronization nor a
        // 16-value comparison on every rendered frame.
        if (node === previousNodes[nodeIndex] && typeof node._aabbVer === "number" &&
          versions[nodeIndex] === node._aabbVer) {
          continue;
        }
        const matrix = node.getWorldTransform().data;
        const offset = nodeIndex * 16;
        for (let component = 0; component < 16; component++) {
          if (snapshot[offset + component] !== matrix[component]) {
            changed = true;
          }
          snapshot[offset + component] = matrix[component];
        }
        previousNodes[nodeIndex] = node;
        versions[nodeIndex] = node._aabbVer;
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
