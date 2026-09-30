/**
 * A square terrain top with a circular opening, preserving the cube's edges.
 */
export class ExcavatedSurface {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {number} halfSize
   * @param {number} radius
   */
  static createMesh(pc, device, halfSize, radius) {
    const mesh = new pc.Mesh(device);
    this.updateMesh(mesh, halfSize, radius);
    return mesh;
  }

  /**
   * @param {import("playcanvas").Mesh} mesh
   * @param {number} halfSize
   * @param {number} radius
   */
  static updateMesh(mesh, halfSize, radius) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const segments = 40;
    for (let index = 0; index <= segments; index += 1) {
      const angle = index * Math.PI * 2 / segments;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const outer = halfSize / Math.max(Math.abs(x), Math.abs(z));
      for (const distance of [radius, outer]) {
        positions.push(x * distance, 0, z * distance);
        normals.push(0, 1, 0);
        uvs.push(x * distance + 0.5, z * distance + 0.5);
      }
      if (index < segments) {
        const start = index * 2;
        indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
      }
    }
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update();
  }
}
