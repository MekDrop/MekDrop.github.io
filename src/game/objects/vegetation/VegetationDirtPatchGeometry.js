const MAX_LOCAL_EXTENT = 0.44;
const MIN_EDGE_INSET = 0.008;
const EDGE_INSET_RANGE = 0.022;
const COORDINATE_PRECISION = 5;
const DIRT_COLORS = Object.freeze([0x8f5b3a, 0x986443, 0x855234, 0xa06a47]);

function randomUnit(seed, index) {
  let hash = 2166136261;
  const text = `${seed}:${index}`;
  for (let character = 0; character < text.length; character += 1) {
    hash ^= text.charCodeAt(character);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
}

function pointKey({ x, z }) {
  return `${x.toFixed(COORDINATE_PRECISION)},${z.toFixed(COORDINATE_PRECISION)}`;
}

function addBoundaryEdge(edges, start, end) {
  const key = `${pointKey(start)}>${pointKey(end)}`;
  const reverseKey = `${pointKey(end)}>${pointKey(start)}`;
  if (edges.has(reverseKey)) {
    edges.delete(reverseKey);
    return;
  }
  edges.set(key, { start, end });
}

function clippedFootprints(footprint) {
  return footprint.flatMap((part) => {
    const left = Math.max(-MAX_LOCAL_EXTENT, part.x - part.width / 2);
    const right = Math.min(MAX_LOCAL_EXTENT, part.x + part.width / 2);
    const near = Math.max(-MAX_LOCAL_EXTENT, part.z - part.depth / 2);
    const far = Math.min(MAX_LOCAL_EXTENT, part.z + part.depth / 2);
    return right > left && far > near ? [{ left, right, near, far }] : [];
  });
}

function buildBoundary(footprint) {
  const edges = new Map();
  for (const { left, right, near, far } of clippedFootprints(footprint)) {
    const nearLeft = { x: left, z: near };
    const nearRight = { x: right, z: near };
    const farRight = { x: right, z: far };
    const farLeft = { x: left, z: far };
    addBoundaryEdge(edges, nearLeft, nearRight);
    addBoundaryEdge(edges, nearRight, farRight);
    addBoundaryEdge(edges, farRight, farLeft);
    addBoundaryEdge(edges, farLeft, nearLeft);
  }

  const edgeByStart = new Map();
  for (const edge of edges.values()) {
    edgeByStart.set(pointKey(edge.start), edge);
  }
  const first = [...edges.values()].sort((left, right) =>
    pointKey(left.start).localeCompare(pointKey(right.start)),
  )[0];
  if (!first) {
    return [];
  }

  const boundary = [];
  let edge = first;
  do {
    boundary.push(edge.start);
    edge = edgeByStart.get(pointKey(edge.end));
  } while (edge && edge !== first && boundary.length <= edges.size);
  return boundary;
}

function irregularizeBoundary(boundary, seed) {
  return boundary.flatMap((point, index) => {
    const next = boundary[(index + 1) % boundary.length];
    const deltaX = next.x - point.x;
    const deltaZ = next.z - point.z;
    const length = Math.hypot(deltaX, deltaZ);
    const inset =
      MIN_EDGE_INSET + randomUnit(seed, index) * EDGE_INSET_RANGE;
    return [
      point,
      {
        x: (point.x + next.x) / 2 - (deltaZ / length) * inset,
        z: (point.z + next.z) / 2 + (deltaX / length) * inset,
      },
    ];
  });
}

function cross(origin, left, right) {
  return (
    (left.x - origin.x) * (right.z - origin.z) -
    (left.z - origin.z) * (right.x - origin.x)
  );
}

function pointInsideTriangle(point, first, second, third) {
  return (
    cross(first, second, point) >= 0 &&
    cross(second, third, point) >= 0 &&
    cross(third, first, point) >= 0
  );
}

function triangulate(outline) {
  const remaining = outline.map((_, index) => index);
  const indices = [];
  while (remaining.length > 3) {
    let clipped = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous =
        remaining[(index - 1 + remaining.length) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (cross(outline[previous], outline[current], outline[next]) <= 0) {
        continue;
      }
      const containsVertex = remaining.some(
        (candidate) =>
          candidate !== previous &&
          candidate !== current &&
          candidate !== next &&
          pointInsideTriangle(
            outline[candidate],
            outline[previous],
            outline[current],
            outline[next],
          ),
      );
      if (containsVertex) {
        continue;
      }
      indices.push(previous, next, current);
      remaining.splice(index, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      break;
    }
  }
  if (remaining.length === 3) {
    indices.push(remaining[0], remaining[2], remaining[1]);
  }
  return indices;
}

export function buildVegetationDirtPatchGeometry(footprint, seed) {
  const outline = irregularizeBoundary(buildBoundary(footprint), seed);
  const positions = [];
  const normals = [];
  const colors = [];
  for (let index = 0; index < outline.length; index += 1) {
    const point = outline[index];
    positions.push(point.x, 0, point.z);
    normals.push(0, 1, 0);
    const color =
      DIRT_COLORS[
        Math.floor(randomUnit(seed, index + 1000) * DIRT_COLORS.length)
      ];
    colors.push(
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      0xff,
    );
  }
  return {
    outline,
    positions,
    normals,
    colors,
    indices: triangulate(outline),
  };
}
