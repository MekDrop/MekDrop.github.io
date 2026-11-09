import { measureKingHemExterior, findKingHemAttachment, findKingHemEdges, sampleKingHemAttachment } from "./KingCapeHem.js";
import { KingCapeTrimSupport } from "./KingCapeTrimSupport.js";

/**
 * @typedef {{a:number,b:number,amount:number,sign:number,lift:number}} KingHemAttachment
 * @typedef {{instance: import("playcanvas").MeshInstance, originalMesh: import("playcanvas").Mesh, originalMaterial: import("playcanvas").Material, originalSkin: import("playcanvas").SkinInstance|null, mesh: import("playcanvas").Mesh, material: import("playcanvas").Material, source: number[], positions: number[], indices: number[], joints: number[], weights: number[], mapping: number[], trimOffsets?: import("playcanvas").Vec3[],trimEdges?:Array<KingHemAttachment|null>}} KingCapeBinding
 * @typedef {{tangent:import("playcanvas").Vec3,bitangent:import("playcanvas").Vec3,normal:import("playcanvas").Vec3}} KingCapeFrame
 */

/**
 * Owns the resident's cloth topology, rigid trim reconstruction and private
 * render resources. Bullet state is borrowed only while sampling live nodes.
 */
export class KingCapeGeometry {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Entity}
   */
  #chest;
  /**
   * @type {number}
   */
  #scale = 1;
  /**
   * @type {KingCapeBinding[]}
   */
  #bindings = [];
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #nodes = [];
  /**
   * @type {number[]}
   */
  #surfaceTriangles = [];
  /**
   * @type {Array<{index:number,sign:number}>}
   */
  #frameNeighbors = [];
  /**
   * @type {KingCapeFrame[]}
   */
  #trimFrames = [];
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #clothPoints = [];
  /**
   * @type {number[]}
   */
  #clothPositions = [];
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameTangent;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameNormal;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameBitangent;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #frameOutward;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #sourcePosition;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #sourceTransformed;
  /**
   * @type {Map<import("playcanvas").SkinInstance, import("playcanvas").Mat4[]>}
   */
  #skinPalettes = new Map();
  /**
   * @type {Array<[number,number]>}
   */
  #hemEdges = [];
  /**
   * @type {Map<KingHemAttachment,{point:import("playcanvas").Vec3,frame:KingCapeFrame}>}
   */
  #hemFrames = new Map();
  /**
   * Downward extent of attached fur below each cloth node, in world units.
   * @type {number[]}
   */
  #furFloorClearance = [];
  /**
   * @type {KingCapeTrimSupport|null}
   */
  #trimSupport = null;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} root
   */
  constructor(pc, root) {
    this.#pc = pc;
    this.#root = root;
    this.#frameTangent = new pc.Vec3();
    this.#frameNormal = new pc.Vec3();
    this.#frameBitangent = new pc.Vec3();
    this.#frameOutward = new pc.Vec3();
    this.#sourcePosition = new pc.Vec3();
    this.#sourceTransformed = new pc.Vec3();
  }

  /**
   * @returns {import("playcanvas").Vec3[]}
   */
  get nodes() {
    return this.#nodes;
  }
  /**
   * @returns {number[]}
   */
  get floorClearances() {
    return this.#furFloorClearance;
  }

  /**
   * @returns {{minimum: import("playcanvas").Vec3, maximum: import("playcanvas").Vec3}}
   */
  get torsoBounds() {
    const inverse = this.#chest.getWorldTransform().clone().invert();
    const minimum = new this.#pc.Vec3(Infinity, Infinity, Infinity);
    const maximum = new this.#pc.Vec3(-Infinity, -Infinity, -Infinity);
    const body = this.#root.findByName("Royal animation rig - Dynasty midnight wool");
    for (const instance of body?.render?.meshInstances ?? []) {
      const binding = this.#readBinding(instance);
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        let lap = false;
        for (let influence = 0; influence < 4; influence++) {
          const offset = vertex * 4 + influence;
          if (binding.weights[offset] > 0 &&
            binding.originalSkin?.bones[binding.joints[offset]]?.name === "King lap cloth") {
            lap = true;
          }
        }
        if (lap) {
          continue;
        }
        const local = inverse.transformPoint(this.#sourceWorld(binding, vertex, matrices));
        minimum.min(local);
        maximum.max(local);
      }
    }

    return {
      minimum,
      maximum,
    };
  }

  /**
   * @param {import("playcanvas").GraphNode} bone
   * @returns {import("playcanvas").Mat4}
   */
  bindTransform(bone) {
    let bindWorld = bone.getWorldTransform();
    for (const binding of this.#bindings) {
      const skin = binding.originalSkin;
      const index = skin?.bones.findIndex(/**
       *
       * @param {import("playcanvas").GraphNode} bone
       */
        bone => bone === bone) ?? -1;
      if (index >= 0) {
        bindWorld = binding.instance.node.getWorldTransform().clone()
          .mul(skin.skin.inverseBindPose[index].clone().invert());
        break;
      }
    }

    return bindWorld;
  }

  /**
   * Samples authored cloth skinning for teleport/resume resets, preserving
   * binding order at shared seams without exposing binding storage.
   * @returns {Generator<{index: number, point: import("playcanvas").Vec3}>}
   */
  *sourcePose() {
    for (const binding of this.#bindings) {
      if (binding.trimOffsets) {
        continue;
      }
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        yield {
          index: binding.mapping[vertex],
          point: this.#sourceWorld(binding, vertex, matrices),
        };
      }
    }
  }

  beginFrame() {
    this.#skinPalettes.clear();
  }

  /**
   * @param {import("playcanvas").MeshInstance[]} instances
   * @param {import("playcanvas").Entity} chest
   * @param {number} scale
   * @param {import("playcanvas").Mat4} rootInverse
   * @returns {{bindPoints: import("playcanvas").Vec3[], triangles: number[], frontSeams: Set<number>, threshold: number}}
   */
  initializeSurface(instances, chest, scale, rootInverse) {
    this.#chest = chest;
    this.#scale = scale;
    const unique = new Map();
    const triangles = [];
    const bindPoints = [];
    const frontSeams = new Set();
    this.#bindings = instances.map(this.#readBinding.bind(this));
    let top = -Infinity, bottom = Infinity;
    for (const binding of this.#bindings) {
      const matrices = this.#skinMatrices(binding);
      for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
        const point = this.#sourceWorld(binding, vertex, matrices);
        const bindPoint = binding.instance.node.getWorldTransform().transformPoint(
          new this.#pc.Vec3(...binding.source.slice(vertex * 3, vertex * 3 + 3)));
        const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
        let index = unique.get(key);
        if (index === undefined) {
          index = this.#nodes.length;
          unique.set(key, index);
          this.#nodes.push(point);
          bindPoints.push(bindPoint);
          const local = rootInverse.transformPoint(point);
          top = Math.max(top, local.y);
          bottom = Math.min(bottom, local.y);
        }
        binding.mapping.push(index);
        const rest = rootInverse.transformPoint(binding.instance.node.getWorldTransform().transformPoint(
          new this.#pc.Vec3(...binding.source.slice(vertex * 3, vertex * 3 + 3))));
        if (rest.z > 0.04 && Math.abs(rest.x) > 0.3) {
          frontSeams.add(index);
        }
      }
      for (const index of binding.indices) {
        triangles.push(binding.mapping[index]);
      }
    }
    // The folded shoulder seam slopes slightly in animated poses. Four percent
    // captures its corner vertices while leaving the next cloth row unpinned.
    const threshold = top - (top - bottom) * 0.04;
    this.#surfaceTriangles = triangles;
    this.#hemEdges = findKingHemEdges(triangles, bindPoints.map(/**
     * @param {import("playcanvas").Vec3} point
     */
      point => rootInverse.transformPoint(point).y));
    const right = this.#root.getWorldTransform().transformVector(new this.#pc.Vec3(1, 0, 0)).normalize();
    this.#frameNeighbors = this.#nodes.map(/**
     *
     * @param {import("playcanvas").Vec3} point
     * @param {number} index
     */
      (point, index) => {
        let nearest = index, score = -1, sign = 1;
        for (let face = 0; face < triangles.length; face += 3) {
          if (!triangles.slice(face, face + 3).includes(index)) {
            continue;
          }
          for (const neighbor of triangles.slice(face, face + 3)) {
            if (neighbor === index) {
              continue;
            }
            const delta = this.#nodes[neighbor].clone().sub(point).normalize();
            const alignment = delta.dot(right);
            if (Math.abs(alignment) > score) {
              nearest = neighbor;
              sign = alignment < 0 ? -1 : 1;
              score = Math.abs(alignment);
            }
          }
        }

        return {
          index: nearest,
          sign,
        };
      });

    return {
      bindPoints,
      triangles,
      frontSeams,
      threshold,
    };
  }

  /**
   * CPU skinning follows PlayCanvas SkinInstance: bone world Ã— inverse bind.
   * @param {KingCapeBinding} binding
   * @returns {import("playcanvas").Mat4[]|null}
   */
  #skinMatrices(binding) {
    const skin = binding.originalSkin;
    if (!skin || !binding.weights.length || !binding.joints.length) {
      return null;
    }

    if (this.#skinPalettes.has(skin)) {
      return this.#skinPalettes.get(skin);
    }
    const matrices = skin.bones.map(/**
     * @param {import("playcanvas").GraphNode} bone
     * @param {number} index
     */
      (bone, index) => new this.#pc.Mat4().mul2(
        bone.getWorldTransform(), skin.skin.inverseBindPose[index],
      ));
    this.#skinPalettes.set(skin, matrices);

    return matrices;
  }

  /**
   * @param {KingCapeBinding} binding
   * @param {number} vertex
   * @param {import("playcanvas").Mat4[]|null} matrices
   * @param {import("playcanvas").Vec3} result
   * @returns {import("playcanvas").Vec3}
   */
  #sourceWorld(binding, vertex, matrices, result = new this.#pc.Vec3()) {
    const position = this.#sourcePosition.set(binding.source[vertex * 3],
      binding.source[vertex * 3 + 1], binding.source[vertex * 3 + 2]);
    if (!matrices) {
      return binding.instance.node.getWorldTransform().transformPoint(position, result);
    }
    result.set(0, 0, 0);
    const transformed = this.#sourceTransformed;
    for (let influence = 0; influence < 4; influence++) {
      const offset = vertex * 4 + influence;
      const weight = binding.weights[offset];
      if (weight > 0) {
        matrices[binding.joints[offset]].transformPoint(position, transformed);
        result.addScaled(transformed, weight);
      }
    }

    return result;
  }

  /**
   * @param {import("playcanvas").MeshInstance} instance
   * @returns {KingCapeBinding}
   */
  #readBinding(instance) {
    const source = [], indices = [], joints = [], weights = [];
    instance.mesh.getPositions(source);
    instance.mesh.getIndices(indices);
    if (instance.skinInstance) {
      instance.mesh.getVertexStream(this.#pc.SEMANTIC_BLENDINDICES, joints);
      instance.mesh.getVertexStream(this.#pc.SEMANTIC_BLENDWEIGHT, weights);
    }

    return {
      instance,
      originalMesh: instance.mesh,
      originalMaterial: instance.material,
      originalSkin: instance.skinInstance ?? null,
      mesh: null,
      material: null,
      source,
      positions: [...source],
      indices,
      joints,
      weights,
      mapping: [],
    };
  }

  /**
   * Clone only this resident's cape; its original skin remains owned by the model.
   * @param {KingCapeBinding} binding
   */
  #cloneBinding(binding) {
    const mesh = new this.#pc.Mesh(binding.originalMesh.device);
    binding.mesh = mesh;
    const normals = [], uv = [];
    binding.originalMesh.getNormals(normals);
    binding.originalMesh.getUvs(0, uv);
    mesh.clear(true, false, binding.source.length / 3, binding.indices.length);
    mesh.setPositions(binding.positions);
    if (normals.length) {
      mesh.setNormals(normals);
    }
    if (uv.length) {
      mesh.setUvs(0, uv);
    }
    mesh.setIndices(binding.indices);
    mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
    const material = binding.originalMaterial.clone();
    binding.material = material;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    binding.instance.skinInstance = null;
    binding.instance.mesh = mesh;
    binding.instance.material = material;
  }

  /**
   * @param {KingHemAttachment} edge
   * @returns {{point:import("playcanvas").Vec3,frame:KingCapeFrame}}
   */
  #sampleHem(edge) {
    if (this.#hemFrames.has(edge)) {
      return this.#hemFrames.get(edge);
    }
    const result = sampleKingHemAttachment({
      pc: this.#pc,
      edge,
      points: this.#clothPoints,
      frames: this.#trimFrames,
      root: this.#root.getPosition(),
      upright: true,
      bodyCenter: this.#chest.getPosition(),
    });
    this.#hemFrames.set(edge, result);

    return result;
  }

  /**
   * @param {import("playcanvas").Vec3} center
   * @returns {KingHemAttachment|null}
   */
  #nearestHem(center) {
    return findKingHemAttachment({
      pc: this.#pc,
      center,
      scale: this.#scale,
      points: this.#clothPoints,
      edges: this.#hemEdges,
      frames: this.#trimFrames,
      root: this.#root.getPosition(),
    });
  }

  /**
   * Rigid trim frames come from the live cloth tangent and normal. This keeps
   * each original block's volume while turning it with the fold beneath it.
   * @param {ReturnType<import("sync-ammo/dist/ammo").btSoftBody["get_m_nodes"]>} nodes
   * @param {number} physicsScale
   * @param {number} floor
   */
  updateFrames(nodes, physicsScale, floor) {
    this.#hemFrames.clear();
    const points = this.#clothPoints;
    for (let index = 0; index < this.#nodes.length; index++) {
      const source = nodes.at(index).get_m_x();
      const point = points[index] ??= new this.#pc.Vec3();
      point.set(source.x(), source.y(), source.z()).mulScalar(1 / physicsScale);
      this.#clothPositions[index * 3] = point.x;
      this.#clothPositions[index * 3 + 1] = point.y;
      this.#clothPositions[index * 3 + 2] = point.z;
    }
    const normals = this.#pc.calculateNormals(this.#clothPositions, this.#surfaceTriangles);
    const chest = this.#chest.getPosition();
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const neighbor = this.#frameNeighbors[index];
      const tangent = this.#frameTangent.sub2(points[neighbor.index], point).mulScalar(neighbor.sign).normalize();
      const normal = this.#frameNormal.set(normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2]);
      const bitangent = this.#frameBitangent.cross(normal, tangent);
      if (bitangent.lengthSq() < 0.000001 && this.#trimFrames[index]) {
        continue;
      }
      bitangent.normalize();
      normal.cross(tangent, bitangent).normalize();
      if (normal.dot(this.#frameOutward.sub2(point, chest)) < 0) {
        normal.mulScalar(-1);
        bitangent.mulScalar(-1);
      }
      const frame = this.#trimFrames[index] ??= {
        tangent: new this.#pc.Vec3(),
        bitangent: new this.#pc.Vec3(),
        normal: new this.#pc.Vec3(),
      };
      frame.tangent.copy(tangent);
      frame.bitangent.copy(bitangent);
      frame.normal.copy(normal);
    }
    this.#trimSupport?.update(this.#trimFrames, this.#sampleHem.bind(this),
      floor, this.#furFloorClearance);
  }

  /**
   * @param {ReturnType<import("sync-ammo/dist/ammo").btSoftBody["get_m_nodes"]>} nodes
   * @param {number} physicsScale
   * @param {number} floor
   */
  writeMeshes(nodes, physicsScale, floor) {
    this.updateFrames(nodes, physicsScale, floor);
    const point = new this.#pc.Vec3();
    for (const binding of this.#bindings) {
      const inverse = binding.instance.node.getWorldTransform().clone().invert();
      const matrices = binding.trimOffsets ? this.#skinMatrices(binding) : null;
      for (let vertex = 0; vertex < binding.mapping.length; vertex++) {
        const index = binding.mapping[vertex];
        if (index < 0) {
          this.#sourceWorld(binding, vertex, matrices, point);
        } else {
          const position = nodes.at(index).get_m_x();
          point.set(position.x() / physicsScale, position.y() / physicsScale, position.z() / physicsScale);
          if (binding.trimOffsets) {
            const edge = binding.trimEdges?.[vertex];
            const sample = edge ? this.#sampleHem(edge) : null;
            const frame = sample?.frame ?? this.#trimFrames[index], offset = binding.trimOffsets[vertex];
            if (sample) {
              point.copy(sample.point);
            }
            point.addScaled(frame.tangent, offset.x).addScaled(frame.bitangent, offset.y).addScaled(frame.normal, offset.z);
          }
        }
        inverse.transformPoint(point, point);
        binding.positions[vertex * 3] = point.x;
        binding.positions[vertex * 3 + 1] = point.y;
        binding.positions[vertex * 3 + 2] = point.z;
      }
      binding.mesh.setPositions(binding.positions);
      binding.mesh.setNormals(this.#pc.calculateNormals(binding.positions, binding.indices));
      binding.mesh.update(this.#pc.PRIMITIVE_TRIANGLES, true);
    }
  }

  /**
   * Sew nearby fur vertices to the cloth nodes and report their mass distribution.
   * @returns {number[]}
   */
  attachTrim() {
    const counts = new Array(this.#nodes.length).fill(0);
    this.#furFloorClearance = new Array(this.#nodes.length).fill(0);
    let total = 0;
    const anchors = [];
    const renders = this.#root.findComponents("render").sort(/**
     *
     * @param {import("playcanvas").RenderComponent} a
     * @param {import("playcanvas").RenderComponent} b
     */
      (a, b) =>
        Number(/Dynasty ink/.test(a.meshInstances[0]?.node.name)) - Number(/Dynasty ink/.test(b.meshInstances[0]?.node.name)));
    for (const render of renders) {
      for (const instance of render.meshInstances) {
        if (!/Dynasty (fur tips|ivory ermine|ink)/.test(instance.node.name)) {
          continue;
        }
        const binding = this.#readBinding(instance);
        const matrices = this.#skinMatrices(binding);
        binding.trimOffsets = [];
        binding.trimEdges = [];
        const sources = [];
        const parents = [];
        const seams = new Map();
        for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
          const point = this.#sourceWorld(binding, vertex, matrices);
          sources.push(point);
          const key = `${Math.round(point.x * 100000)}:${Math.round(point.y * 100000)}:${Math.round(point.z * 100000)}`;
          parents.push(seams.get(key) ?? vertex);
          seams.set(key, parents[vertex]);
        }
        /**
         * @param {number} index @returns {number}
         */
        const find = (index) => {
          while (parents[index] !== index) {
            index = parents[index];
          }

          return index;
        };
        for (let face = 0; face < binding.indices.length; face += 3) {
          const first = find(binding.indices[face]);
          parents[find(binding.indices[face + 1])] = first;
          parents[find(binding.indices[face + 2])] = first;
        }
        const centers = new Map();
        for (let vertex = 0; vertex < sources.length; vertex++) {
          const group = find(vertex);
          if (!centers.has(group)) {
            centers.set(group, {
              point: new this.#pc.Vec3(),
              count: 0,
              cape: !binding.originalSkin,
              nearest: -1,
              edge: null,
            });
          }
          const center = centers.get(group);
          center.point.add(sources[vertex]);
          center.count++;
          for (let influence = 0; influence < 4; influence++) {
            const offset = vertex * 4 + influence;
            const bone = binding.originalSkin?.bones[binding.joints[offset]];
            if (binding.weights[offset] > 0 && /^King cape [012]$/.test(bone?.name ?? "")) {
              center.cape = true;
            }
          }
        }
        for (const center of centers.values()) {
          center.point.mulScalar(1 / center.count);
          if (!center.cape) {
            continue;
          }
          let distance = 0.1 * this.#scale;
          for (let index = 0; index < this.#nodes.length; index++) {
            const separation = center.point.distance(this.#nodes[index]);
            if (separation < distance) {
              center.nearest = index;
              distance = separation;
            }
          }
          center.edge = this.#nearestHem(center.point);
          if (center.edge) {
            center.nearest = center.edge.amount < 0.5 ? center.edge.a : center.edge.b;
          }
          if (/Dynasty ink/.test(instance.node.name)) {
            let nearest = null, separation = 0.09 * this.#scale;
            for (const anchor of anchors) {
              const gap = center.point.distance(anchor.point);
              if (gap < separation) {
                nearest = anchor;
                separation = gap;
              }
            }
            if (nearest) {
              center.nearest = nearest.nearest;
              center.edge = nearest.edge;
              center.lift = nearest.lift;
            }
          } else {
            anchors.push(center);
          }
        }
        if (!/Dynasty ink/.test(instance.node.name)) {
          for (const [group, center] of centers) {
            if (center.nearest < 0) {
              continue;
            }
            const sample = center.edge ? this.#sampleHem(center.edge) : {
              point: this.#nodes[center.nearest],
              frame: this.#trimFrames[center.nearest],
            };
            let minimum = Infinity;
            for (let vertex = 0; vertex < sources.length; vertex++) {
              if (find(vertex) === group) {
                minimum = Math.min(minimum, sources[vertex].clone().sub(sample.point).dot(sample.frame.normal));
              }
            }
            // Fur is sewn into the cloth: retain a shallow overlap rather
            // than floating the complete rigid block clear of the surface.
            center.lift = Math.max(0, -0.023 * this.#scale - minimum);
            if (center.edge) {
              center.edge.lift = center.lift;
            }
          }
        }
        let attached = false;
        for (let vertex = 0; vertex < binding.source.length / 3; vertex++) {
          const source = sources[vertex];
          const center = centers.get(find(vertex));
          const nearest = center.nearest;
          binding.mapping.push(nearest);
          const edge = nearest < 0 ? null : center.edge;
          binding.trimEdges.push(edge);
          const sample = edge ? this.#sampleHem(edge) : null;
          const delta = nearest < 0 ? new this.#pc.Vec3() : source.clone().sub(sample?.point ?? this.#nodes[nearest]);
          const frame = sample?.frame ?? this.#trimFrames[nearest];
          const offset = nearest < 0 ? delta : new this.#pc.Vec3(
            delta.dot(frame.tangent), delta.dot(frame.bitangent), delta.dot(frame.normal),
          );
          offset.x *= edge ? 1.2 : 1;
          offset.z += center.lift ?? 0;
          binding.trimOffsets.push(offset);
          if (nearest >= 0) {
            const downward = -(frame.tangent.y * offset.x + frame.bitangent.y * offset.y + frame.normal.y * offset.z);
            for (const anchor of edge ? [edge.a, edge.b] : [nearest]) {
              this.#furFloorClearance[anchor] = Math.max(this.#furFloorClearance[anchor], downward);
            }
            if (edge) {
              counts[edge.a] += 1 - edge.amount;
              counts[edge.b] += edge.amount;
            } else {
              counts[nearest]++;
            }
            total++;
            attached = true;
          }
        }
        if (attached) {
          this.#bindings.push(binding);
        }
      }
    }
    this.#trimSupport = new KingCapeTrimSupport(this.#bindings);

    return total > 0 ? counts.map(/**
     *
     * @param {number} count
     */
      count => 0.3 / counts.length + 0.15 * count / total) : [];
  }


  cloneMeshes() {
    for (const binding of this.#bindings) {
      this.#cloneBinding(binding);
    }
  }

  /**
   * @returns {number}
   */
  get minHemExteriorDistance() {
    return measureKingHemExterior(this.#pc, this.#bindings, this.#sampleHem.bind(this));
  }

  destroy() {
    for (const binding of this.#bindings) {
      binding.instance.mesh = binding.originalMesh;
      binding.instance.material = binding.originalMaterial;
      binding.instance.skinInstance = binding.originalSkin;
      binding.mesh?.destroy();
      binding.material?.destroy();
    }
    this.#bindings = [];
    this.#nodes = [];
    this.#surfaceTriangles = [];
    this.#frameNeighbors = [];
    this.#trimFrames = [];
    this.#clothPoints = [];
    this.#clothPositions = [];
    this.#skinPalettes.clear();
    this.#hemEdges = [];
    this.#hemFrames.clear();
    this.#furFloorClearance = [];
    this.#trimSupport = null;
  }
}
