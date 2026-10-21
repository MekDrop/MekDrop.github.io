/**
 * A square terrain top with a circular opening, preserving the cube's edges.
 */
export class ExcavatedSurface {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {number} halfSize
   * @param {number} radius
   * @param {number|null} [fillDepth] Filled soil height relative to the cube top.
   * @param {Array<Array<number>>|null} [outline] Authored XZ surface perimeter.
   * @param {boolean} [fillOnly] Emit only the soil face for its terrain material.
   */
  static createMesh(pc, device, halfSize, radius, fillDepth = null, fillOnly = false, outline = null) {
    const mesh = new pc.Mesh(device);
    this.updateMesh(mesh, halfSize, radius, fillDepth, fillOnly, outline);

    return mesh;
  }

  /**
   * @param {import("playcanvas").Mesh} mesh
   * @param {number} halfSize
   * @param {number} radius
   * @param {number|null} [fillDepth] Filled soil height relative to the cube top.
   * @param {Array<Array<number>>|null} [outline] Authored XZ surface perimeter.
   * @param {boolean} [fillOnly] Emit only the soil face for its terrain material.
   */
  static updateMesh(mesh, halfSize, radius, fillDepth = null, fillOnly = false, outline = null) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const segments = outline?.length ?? 40;
    for (let index = 0; index <= (fillOnly ? -1 : segments); index += 1) {
      const angle = index * Math.PI * 2 / segments;
      const point = outline?.[index % segments];
      const distance = point ? Math.hypot(...point) : radius;
      const x = point ? point[0] / distance : Math.cos(angle);
      const z = point ? point[1] / distance : Math.sin(angle);
      const outer = halfSize / Math.max(Math.abs(x), Math.abs(z));
      for (const distance of [point ? Math.hypot(...point) : radius, outer]) {
        positions.push(x * distance, 0, z * distance);
        normals.push(0, 1, 0);
        uvs.push(x * distance + 0.5, z * distance + 0.5);
      }
      if (index < segments) {
        const start = index * 2;
        indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
      }
    }
    // Refill belongs to the cube cap, without a raised prop or side walls.
    if (fillDepth !== null) {
      const center = positions.length / 3;
      positions.push(0, fillDepth, 0);
      normals.push(0, 1, 0);
      uvs.push(0.5, 0.5);
      for (let index = 0; index <= segments; index += 1) {
        const angle = index * Math.PI * 2 / segments;
        const x = outline?.[index % segments][0] ?? Math.cos(angle) * radius;
        const z = outline?.[index % segments][1] ?? Math.sin(angle) * radius;
        positions.push(x, fillDepth, z);
        normals.push(0, 1, 0);
        uvs.push(x + 0.5, z + 0.5);
        if (index < segments) {
          indices.push(center, center + index + 2, center + index + 1);
        }
      }
    }
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update();
  }
}
