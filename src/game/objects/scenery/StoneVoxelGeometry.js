// Each row is a group of separate cubes, matching the voxel construction of bushes.
const STONE_ROWS = [
  [
    [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, 1],
      [1, -1],
    ],
    [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
    [[0, 0]],
  ],
  [
    [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [-1, -1],
      [0, -1],
      [0, 0],
      [1, 0],
    ],
    [
      [-1, 0],
      [0, 0],
    ],
  ],
  [
    [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ],
];
const VOXEL_TONES = [0.86, 0.98, 0.74, 0.82];

function addPolygon(geometry, points, normal, color) {
  const [nx, ny, nz] = normal;
  const length = Math.hypot(nx, ny, nz);
  const unit = [nx / length, ny / length, nz / length];
  const first = points[0];
  const second = points[1];
  const third = points[2];
  const ax = second[0] - first[0];
  const ay = second[1] - first[1];
  const az = second[2] - first[2];
  const bx = third[0] - first[0];
  const by = third[1] - first[1];
  const bz = third[2] - first[2];
  const facing =
    (ay * bz - az * by) * nx +
    (az * bx - ax * bz) * ny +
    (ax * by - ay * bx) * nz;
  if (facing < 0) {
    points.reverse();
  }
  const vertexOffset = geometry.positions.length / 3;
  const faceShade = unit[1] > 0.25 ? 1 : unit[1] < -0.25 ? 0.66 : 0.84;
  for (const point of points) {
    geometry.positions.push(...point);
    geometry.normals.push(...unit);
    geometry.colors.push(
      Math.round(color[0] * faceShade),
      Math.round(color[1] * faceShade),
      Math.round(color[2] * faceShade),
      255,
    );
  }
  geometry.indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
  if (points.length === 4) {
    geometry.indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 3);
  }
}

function addVoxel(geometry, center, size, color) {
  const half = size.map((dimension) => dimension / 2);
  const bevel = Math.min(...half) * 0.12;
  const inner = half.map((value) => value - bevel);
  for (let axis = 0; axis < 3; axis++) {
    const other = [0, 1, 2].filter((index) => index !== axis);
    for (const sign of [-1, 1]) {
      const points = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) => {
        const point = [...center];
        point[axis] += sign * half[axis];
        point[other[0]] += a * inner[other[0]];
        point[other[1]] += b * inner[other[1]];
        return point;
      });
      const normal = [0, 0, 0];
      normal[axis] = sign;
      addPolygon(geometry, points, normal, color);
    }
  }
  for (let first = 0; first < 3; first++) {
    for (let second = first + 1; second < 3; second++) {
      const third = [0, 1, 2].find((axis) => axis !== first && axis !== second);
      for (const firstSign of [-1, 1]) {
        for (const secondSign of [-1, 1]) {
          const points = [
            [half[first], inner[second], -inner[third]],
            [half[first], inner[second], inner[third]],
            [inner[first], half[second], inner[third]],
            [inner[first], half[second], -inner[third]],
          ].map((coordinates) => {
            const point = [...center];
            point[first] += coordinates[0] * firstSign;
            point[second] += coordinates[1] * secondSign;
            point[third] += coordinates[2];
            return point;
          });
          const normal = [0, 0, 0];
          normal[first] = firstSign;
          normal[second] = secondSign;
          addPolygon(geometry, points, normal, color);
        }
      }
    }
  }
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        const points = [
          [xSign * half[0], ySign * inner[1], zSign * inner[2]],
          [xSign * inner[0], ySign * half[1], zSign * inner[2]],
          [xSign * inner[0], ySign * inner[1], zSign * half[2]],
        ].map(([x, y, z]) => [center[0] + x, center[1] + y, center[2] + z]);
        addPolygon(geometry, points, [xSign, ySign, zSign], color);
      }
    }
  }
}

export function buildStoneVoxelGeometry(stones) {
  const geometry = { positions: [], normals: [], colors: [], indices: [] };
  for (const stone of stones) {
    const rows = STONE_ROWS[stone.variant];
    const width = stone.diameter / 3;
    const height = stone.height / stone.levels;
    const angle = (stone.rotation * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const tint = [
      (stone.color >> 16) & 0xff,
      (stone.color >> 8) & 0xff,
      stone.color & 0xff,
    ];
    for (let row = 0; row < stone.levels; row++) {
      for (const [col, depth] of rows[row]) {
        const shade =
          VOXEL_TONES[
            (stone.variant * 5 + row * 3 + col * 7 + depth * 11 + 40) %
              VOXEL_TONES.length
          ];
        const color = tint.map((channel) => channel * shade);
        const x = stone.x + (col * cosine - depth * sine) * width;
        const z = stone.z + (col * sine + depth * cosine) * width;
        const y = stone.ground + (row + 0.5) * height;
        addVoxel(geometry, [x, y, z], [width, height, width], color);
      }
    }
  }
  return geometry;
}
