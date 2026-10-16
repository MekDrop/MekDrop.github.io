/**
 * Split triangles at the fold so both halves share an exact attachment edge.
 * @param {number[]} positions Sheet-local vertices, with +X along the leaf.
 * @param {number[]} normals
 * @param {number[]} indices
 * @param {number} length
 * @returns {{positions: number[], normals: number[], sections: number[], indices: number[]}}
 */
export function splitPaperGeometry(positions, normals, indices, length) {
  const result = {
    positions: [],
    normals: [],
    sections: [],
    indices: [],
  };
  const fold = length / 2;
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const vertices = indices.slice(triangle, triangle + 3).map(
      /**
       * @param {number} index
       */
      (index) => [...positions.slice(index * 3, index * 3 + 3), ...normals.slice(index * 3, index * 3 + 3)],
    );
    for (let section = 0; section < 2; section++) {
      const polygon = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = vertices[edge], b = vertices[(edge + 1) % 3];
        const insideA = section ? a[0] >= fold : a[0] <= fold;
        const insideB = section ? b[0] >= fold : b[0] <= fold;
        if (insideA) {
          polygon.push(a);
        }
        if (insideA !== insideB) {
          const fraction = (fold - a[0]) / (b[0] - a[0]);
          polygon.push(a.map(
            /**
             * @param {number} value
             * @param {number} index
             */
            (value, index) => value + (b[index] - value) * fraction,
          ));
        }
      }
      const base = result.positions.length / 3;
      for (const vertex of polygon) {
        result.positions.push(...vertex.slice(0, 3));
        result.normals.push(...vertex.slice(3));
        result.sections.push(section);
      }
      for (let vertex = 1; vertex < polygon.length - 1; vertex++) {
        result.indices.push(base, base + vertex, base + vertex + 1);
      }
    }
  }

  return result;
}
