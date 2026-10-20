/**
 * Interleaved transforms and edge settings for a living-grass instance.
 */
export class GrassInstanceData {
  /**
   * @returns {number}
   */
  static get stride() {
    return 22;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @returns {import("playcanvas").VertexFormat}
   */
  static createFormat(pc, device) {
    return new pc.VertexFormat(device, [
      {
        semantic: pc.SEMANTIC_ATTR11,
        components: 4,
        type: pc.TYPE_FLOAT32,
      },
      {
        semantic: pc.SEMANTIC_ATTR12,
        components: 4,
        type: pc.TYPE_FLOAT32,
      },
      {
        semantic: pc.SEMANTIC_ATTR14,
        components: 4,
        type: pc.TYPE_FLOAT32,
      },
      {
        semantic: pc.SEMANTIC_ATTR15,
        components: 4,
        type: pc.TYPE_FLOAT32,
      },
      {
        semantic: pc.SEMANTIC_ATTR8,
        components: 4,
        type: pc.TYPE_FLOAT32,
      },
      {
        semantic: pc.SEMANTIC_ATTR9,
        components: 2,
        type: pc.TYPE_FLOAT32,
      },
    ]);
  }

  /**
   * @param {number[]} data
   * @param {Float32Array} matrix
   * @param {number[]} boundaryExtension
   * @param {number[]} edgeJoins
   */
  static append(data, matrix, boundaryExtension, edgeJoins) {
    data.push(...matrix, ...boundaryExtension, ...edgeJoins);
  }
}
