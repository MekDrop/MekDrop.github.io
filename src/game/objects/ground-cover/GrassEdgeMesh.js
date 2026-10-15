/**
 * A closed, shallow sod lip. Reused by every exposed tile edge.
 */
export class GrassEdgeMesh {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   */
  static create(pc, device) {
    const positions = [];
    const indices = [];
    // Bury the inner root below the lawn. Only a thin, tapered outer edge
    // reaches outside the soil face; there is no exposed horizontal trim.
    for (let segment = 0; segment <= 16; segment += 1) {
      const x = segment / 16 - 0.5;
      const grain = segment === 16 ? 0 : ((segment * 37 + segment * segment * 13) % 17) / 16;
      const depth = segment === 0 || segment === 16 ? 0.085 : 0.075 + grain * 0.02;
      const roughness = (grain - 0.5) * 0.006;
      // Both rows of the hanging face must clear the soil plane at z=0.01.
      // Returning the tips into that plane makes grazing camera movement
      // alternate between soil and turf at almost identical depths.
      for (const [y, z] of [[-0.012, -0.035], [0.002, 0.01],
        [-0.012, 0.014 + roughness], [-depth, 0.012],
        [-depth + 0.008, -0.012]]) {
        positions.push(x, y, z);
      }
      if (segment === 0) continue;
      for (let ring = 0; ring < 5; ring += 1) {
        const a = (segment - 1) * 5 + ring;
        const b = segment * 5 + ring;
        const nextA = (segment - 1) * 5 + (ring + 1) % 5;
        const nextB = segment * 5 + (ring + 1) % 5;
        indices.push(a, nextA, b, b, nextA, nextB);
      }
    }
    indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3);
    const end = 16 * 5;
    indices.push(end, end + 1, end + 2, end, end + 2, end + 3,
      end, end + 3, end + 4);
    const mesh = new pc.Mesh(device);
    mesh.setPositions(positions);
    mesh.setNormals(pc.calculateNormals(positions, indices));
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    return mesh;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {import("playcanvas").Mesh} mesh
   * @param {import("playcanvas").Material} material
   * @param {number[]} matrices
   */
  static batch(pc, device, mesh, material, matrices) {
    const vertexBuffer = new pc.VertexBuffer(device,
      pc.VertexFormat.getDefaultInstancingFormat(device), matrices.length / 16,
      {
        data: new Float32Array(matrices),
        usage: pc.BUFFER_DYNAMIC,
      });
    const entity = new pc.Entity("Sculpted turf edges");
    const instance = new pc.MeshInstance(mesh, material, entity);
    instance.setInstancing(vertexBuffer, false);
    instance.castShadow = false;
    instance.receiveShadow = true;
    entity.addComponent("render", {
      meshInstances: [instance],
      castShadows: false,
      receiveShadows: true,
    });
    return {
      entity,
      vertexBuffer,
    };
  }
}
