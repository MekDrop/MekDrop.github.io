const LONGITUDE_SEGMENTS = 8;
const LATITUDE_SEGMENTS = 5;
const RADIUS = 0.5;

export class HeroMeshFactory {
  static createFacetedVolume(pc, graphicsDevice) {
    const geometry = new pc.Geometry();
    geometry.positions = [];
    geometry.normals = [];
    geometry.uvs = [];
    geometry.indices = [];

    const pointAt = (longitude, latitude) => {
      const theta = longitude * Math.PI * 2;
      const phi = latitude * Math.PI;
      const radius = Math.sin(phi) * RADIUS;
      return [
        Math.cos(theta) * radius,
        Math.cos(phi) * RADIUS,
        Math.sin(theta) * radius,
      ];
    };
    const appendFace = (points, uvs) => {
      const edgeA = points[1].map((value, axis) => value - points[0][axis]);
      const edgeB = points[2].map((value, axis) => value - points[0][axis]);
      let normal = [
        edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
        edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
        edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0],
      ];
      const center = [0, 1, 2].map(
        (axis) =>
          points.reduce((sum, point) => sum + point[axis], 0) / points.length,
      );
      if (
        normal.reduce(
          (sum, component, axis) => sum + component * center[axis],
          0,
        ) < 0
      ) {
        points.reverse();
        uvs.reverse();
        normal = normal.map((component) => -component);
      }
      const normalLength = Math.hypot(...normal);
      normal = normal.map((component) => component / normalLength);
      const start = geometry.positions.length / 3;

      points.forEach((point, index) => {
        geometry.positions.push(...point);
        geometry.normals.push(...normal);
        geometry.uvs.push(...uvs[index]);
      });
      for (let index = 1; index < points.length - 1; index += 1) {
        geometry.indices.push(start, start + index, start + index + 1);
      }
    };

    for (let latitude = 0; latitude < LATITUDE_SEGMENTS; latitude += 1) {
      const top = latitude / LATITUDE_SEGMENTS;
      const bottom = (latitude + 1) / LATITUDE_SEGMENTS;
      for (
        let longitude = 0;
        longitude < LONGITUDE_SEGMENTS;
        longitude += 1
      ) {
        const left = longitude / LONGITUDE_SEGMENTS;
        const right = (longitude + 1) / LONGITUDE_SEGMENTS;
        if (latitude === 0) {
          appendFace(
            [
              pointAt((left + right) / 2, top),
              pointAt(right, bottom),
              pointAt(left, bottom),
            ],
            [
              [(left + right) / 2, top],
              [right, bottom],
              [left, bottom],
            ],
          );
          continue;
        }
        if (latitude === LATITUDE_SEGMENTS - 1) {
          appendFace(
            [
              pointAt(left, top),
              pointAt(right, top),
              pointAt((left + right) / 2, bottom),
            ],
            [
              [left, top],
              [right, top],
              [(left + right) / 2, bottom],
            ],
          );
          continue;
        }
        appendFace(
          [
            pointAt(left, top),
            pointAt(right, top),
            pointAt(right, bottom),
            pointAt(left, bottom),
          ],
          [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
          ],
        );
      }
    }

    const mesh = pc.Mesh.fromGeometry(graphicsDevice, geometry);
    mesh.incRefCount();
    return mesh;
  }
}
