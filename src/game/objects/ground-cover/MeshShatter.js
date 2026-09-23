const MIN_SHARDS_PER_MESH = 2;
const MAX_SHARDS_PER_MESH = 6;
const TRIANGLES_PER_SHARD = 10;
const FILL_DEPTH_SCALE = 0.45;
const MIN_FILL_DEPTH = 0.01;

export class MeshShatter {
  #pc;
  #app;
  #modelLibrary;

  constructor({ pc, app, modelLibrary }) {
    this.#pc = pc;
    this.#app = app;
    this.#modelLibrary = modelLibrary;
  }

  shatter({ modelUrl, scale = 1, seed = 0, shardCountForMesh = null }) {
    const source = this.#modelLibrary.instantiate(modelUrl);
    const rootInverse = new this.#pc.Mat4()
      .copy(source.getWorldTransform())
      .invert();
    const pieces = [];
    const pending = [source];
    let meshIndex = 0;

    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        pieces.push(
          ...this.#shatterMesh({
            meshInstance,
            rootInverse,
            scale,
            seed: seed + meshIndex * 0x9e3779b1,
            shardCountForMesh,
          }),
        );
        meshIndex += 1;
      }
      pending.push(...entity.children);
    }

    source.destroy();
    return pieces;
  }

  #shatterMesh({ meshInstance, rootInverse, scale, seed, shardCountForMesh }) {
    const geometry = this.#readGeometry(meshInstance, rootInverse);
    const triangleCount = geometry.indices.length / 3;
    if (!triangleCount) {
      return [];
    }

    const requestedShardCount = shardCountForMesh
      ? shardCountForMesh({
          name: meshInstance.node.name,
          triangleCount,
        })
      : Math.max(
          MIN_SHARDS_PER_MESH,
          Math.min(
            MAX_SHARDS_PER_MESH,
            Math.round(triangleCount / TRIANGLES_PER_SHARD),
          ),
        );
    if (requestedShardCount <= 0) {
      return [];
    }
    const shardCount = Math.min(
      triangleCount,
      Math.max(1, Math.round(requestedShardCount)),
    );
    const centroids = this.#triangleCentroids(geometry);
    const random = this.#createRandom(seed);
    const clusterSeeds = this.#chooseClusterSeeds(
      centroids,
      shardCount,
      random,
    );
    const clusters = Array.from({ length: shardCount }, () => []);

    centroids.forEach((centroid, triangleIndex) => {
      let closestCluster = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      clusterSeeds.forEach((clusterSeed, clusterIndex) => {
        const distance = this.#distanceSquared(centroid, clusterSeed);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCluster = clusterIndex;
        }
      });
      clusters[closestCluster].push(triangleIndex);
    });

    return clusters
      .filter((cluster) => cluster.length)
      .map((cluster) =>
        this.#createPiece({
          geometry,
          triangleIndices: cluster,
          material: meshInstance.material,
          scale,
        }),
      );
  }

  #readGeometry(meshInstance, rootInverse) {
    const sourceMesh = meshInstance.mesh;
    const sourcePositions = [];
    const sourceNormals = [];
    const sourceUvs = [];
    const sourceIndices = [];
    const vertexCount = sourceMesh.getPositions(sourcePositions);
    sourceMesh.getNormals(sourceNormals);
    sourceMesh.getUvs(0, sourceUvs);
    sourceMesh.getIndices(sourceIndices);

    const modelTransform = new this.#pc.Mat4().mul2(
      rootInverse,
      meshInstance.node.getWorldTransform(),
    );
    const normalTransform = new this.#pc.Mat4()
      .copy(modelTransform)
      .invert()
      .transpose();
    const sourcePosition = new this.#pc.Vec3();
    const transformedPosition = new this.#pc.Vec3();
    const sourceNormal = new this.#pc.Vec3();
    const transformedNormal = new this.#pc.Vec3();
    const positions = [];
    const normals = [];
    const uvs = [];

    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const positionOffset = vertex * 3;
      sourcePosition.set(
        sourcePositions[positionOffset],
        sourcePositions[positionOffset + 1],
        sourcePositions[positionOffset + 2],
      );
      modelTransform.transformPoint(sourcePosition, transformedPosition);
      positions.push(
        transformedPosition.x,
        transformedPosition.y,
        transformedPosition.z,
      );

      sourceNormal.set(
        sourceNormals[positionOffset] ?? 0,
        sourceNormals[positionOffset + 1] ?? 1,
        sourceNormals[positionOffset + 2] ?? 0,
      );
      normalTransform
        .transformVector(sourceNormal, transformedNormal)
        .normalize();
      normals.push(
        transformedNormal.x,
        transformedNormal.y,
        transformedNormal.z,
      );
      const uvOffset = vertex * 2;
      uvs.push(sourceUvs[uvOffset] ?? 0, sourceUvs[uvOffset + 1] ?? 0);
    }

    const indices = [];
    const primitive = sourceMesh.primitive[0];
    if (primitive.indexed) {
      const baseVertex = primitive.baseVertex ?? 0;
      for (
        let index = primitive.base;
        index < primitive.base + primitive.count;
        index += 1
      ) {
        indices.push(sourceIndices[index] + baseVertex);
      }
    } else {
      for (
        let index = primitive.base;
        index < primitive.base + primitive.count;
        index += 1
      ) {
        indices.push(index);
      }
    }

    return { positions, normals, uvs, indices };
  }

  #triangleCentroids({ positions, indices }) {
    const centroids = [];
    for (let index = 0; index < indices.length; index += 3) {
      const first = indices[index] * 3;
      const second = indices[index + 1] * 3;
      const third = indices[index + 2] * 3;
      centroids.push({
        x: (positions[first] + positions[second] + positions[third]) / 3,
        y:
          (positions[first + 1] +
            positions[second + 1] +
            positions[third + 1]) /
          3,
        z:
          (positions[first + 2] +
            positions[second + 2] +
            positions[third + 2]) /
          3,
      });
    }
    return centroids;
  }

  #chooseClusterSeeds(centroids, count, random) {
    const seeds = [centroids[Math.floor(random() * centroids.length)]];
    while (seeds.length < count) {
      let farthest = centroids[0];
      let farthestDistance = -1;
      for (const centroid of centroids) {
        const nearestDistance = Math.min(
          ...seeds.map((seed) => this.#distanceSquared(centroid, seed)),
        );
        const weightedDistance = nearestDistance * (0.9 + random() * 0.2);
        if (weightedDistance > farthestDistance) {
          farthest = centroid;
          farthestDistance = weightedDistance;
        }
      }
      seeds.push(farthest);
    }
    return seeds;
  }

  #createPiece({ geometry, triangleIndices, material, scale }) {
    const centroid = { x: 0, y: 0, z: 0 };
    let vertexCount = 0;
    for (const triangleIndex of triangleIndices) {
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceVertex = geometry.indices[triangleIndex * 3 + corner];
        const offset = sourceVertex * 3;
        centroid.x += geometry.positions[offset];
        centroid.y += geometry.positions[offset + 1];
        centroid.z += geometry.positions[offset + 2];
        vertexCount += 1;
      }
    }
    centroid.x /= vertexCount;
    centroid.y /= vertexCount;
    centroid.z /= vertexCount;

    const positions = [];
    const normals = [];
    const uvs = [];
    const fillAnchor = this.#createFillAnchor({
      geometry,
      triangleIndices,
      centroid,
      scale,
    });
    let radiusSquared = 0;
    for (const triangleIndex of triangleIndices) {
      const vertices = [];
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceVertex = geometry.indices[triangleIndex * 3 + corner];
        const positionOffset = sourceVertex * 3;
        const x = (geometry.positions[positionOffset] - centroid.x) * scale;
        const y = (geometry.positions[positionOffset + 1] - centroid.y) * scale;
        const z = (geometry.positions[positionOffset + 2] - centroid.z) * scale;
        const normal = {
          x: geometry.normals[positionOffset],
          y: geometry.normals[positionOffset + 1],
          z: geometry.normals[positionOffset + 2],
        };
        const uvOffset = sourceVertex * 2;
        const uv = {
          u: geometry.uvs[uvOffset],
          v: geometry.uvs[uvOffset + 1],
        };
        vertices.push({ x, y, z, normal, uv });
        this.#pushVertex({ positions, normals, uvs, vertex: vertices[corner] });
        radiusSquared = Math.max(radiusSquared, x * x + y * y + z * z);
      }
      this.#appendFillFaces({
        positions,
        normals,
        uvs,
        vertices,
        fillAnchor,
      });
    }
    radiusSquared = Math.max(
      radiusSquared,
      fillAnchor.x * fillAnchor.x +
        fillAnchor.y * fillAnchor.y +
        fillAnchor.z * fillAnchor.z,
    );

    const mesh = new this.#pc.Mesh(this.#app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.update();

    return {
      mesh,
      material,
      centroid: {
        x: centroid.x * scale,
        y: centroid.y * scale,
        z: centroid.z * scale,
      },
      radius: Math.sqrt(radiusSquared),
      triangleCount: triangleIndices.length,
    };
  }

  #createFillAnchor({ geometry, triangleIndices, centroid, scale }) {
    const normal = { x: 0, y: 0, z: 0 };
    let farthestVertexDistanceSquared = 0;
    for (const triangleIndex of triangleIndices) {
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceVertex = geometry.indices[triangleIndex * 3 + corner];
        const positionOffset = sourceVertex * 3;
        normal.x += geometry.normals[positionOffset];
        normal.y += geometry.normals[positionOffset + 1];
        normal.z += geometry.normals[positionOffset + 2];
        const x = (geometry.positions[positionOffset] - centroid.x) * scale;
        const y = (geometry.positions[positionOffset + 1] - centroid.y) * scale;
        const z = (geometry.positions[positionOffset + 2] - centroid.z) * scale;
        farthestVertexDistanceSquared = Math.max(
          farthestVertexDistanceSquared,
          x * x + y * y + z * z,
        );
      }
    }
    const normalLength = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const depth = Math.max(
      MIN_FILL_DEPTH,
      Math.sqrt(farthestVertexDistanceSquared) * FILL_DEPTH_SCALE,
    );
    return {
      x: -(normal.x / normalLength) * depth,
      y: -(normal.y / normalLength) * depth,
      z: -(normal.z / normalLength) * depth,
      uv: { u: 0.5, v: 0.5 },
    };
  }

  #appendFillFaces({ positions, normals, uvs, vertices, fillAnchor }) {
    for (let index = 0; index < vertices.length; index += 1) {
      const first = vertices[index];
      const second = vertices[(index + 1) % vertices.length];
      const normal = this.#faceNormal(second, first, fillAnchor);
      this.#pushVertex({
        positions,
        normals,
        uvs,
        vertex: { ...second, normal },
      });
      this.#pushVertex({
        positions,
        normals,
        uvs,
        vertex: { ...first, normal },
      });
      this.#pushVertex({
        positions,
        normals,
        uvs,
        vertex: { ...fillAnchor, normal },
      });
    }
  }

  #pushVertex({ positions, normals, uvs, vertex }) {
    positions.push(vertex.x, vertex.y, vertex.z);
    normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
    uvs.push(vertex.uv.u, vertex.uv.v);
  }

  #faceNormal(first, second, third) {
    const edgeAx = second.x - first.x;
    const edgeAy = second.y - first.y;
    const edgeAz = second.z - first.z;
    const edgeBx = third.x - first.x;
    const edgeBy = third.y - first.y;
    const edgeBz = third.z - first.z;
    const normal = {
      x: edgeAy * edgeBz - edgeAz * edgeBy,
      y: edgeAz * edgeBx - edgeAx * edgeBz,
      z: edgeAx * edgeBy - edgeAy * edgeBx,
    };
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length,
    };
  }

  #distanceSquared(first, second) {
    const x = first.x - second.x;
    const y = first.y - second.y;
    const z = first.z - second.z;
    return x * x + y * y + z * z;
  }

  #createRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }
}
