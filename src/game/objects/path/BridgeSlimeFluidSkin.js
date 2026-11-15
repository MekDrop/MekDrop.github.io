import { bridgeSlimeImplicitSurface } from "./BridgeSlimeImplicitSurface.js";
import { bridgeSlimeFluidLobes } from "./BridgeSlimeFluidLobes.js";

/**
 * One implicit wet surface owns forming gel. Extraction is rate limited;
 * settled tissue is skinned directly to native poses without fluid clocks.
 */
export class BridgeSlimeFluidSkin {
  /**
   * @param {{pc:typeof import("playcanvas"),root:import("playcanvas").Entity}} options
   */
  constructor({ pc, root }) {
    this.pc = pc;
    this.root = root;
    this.age = Infinity;
    this.iso = null;
    this.targetVolume = 0;
    this.faces = new Map();
    this.stats = {
      builds: 0,
      totalMs: 0,
      maxMs: 0,
      cells: 0,
    };
    const material = new pc.StandardMaterial();
    material.name = "Opaque viscous living gold";
    material.diffuse = new pc.Color(1, 0.79, 0.12);
    material.emissive = new pc.Color(0.5, 0.3, 0.025);
    material.cull = pc.CULLFACE_NONE;
    material.twoSidedLighting = true;
    material.specular = new pc.Color(1, 0.96, 0.8);
    material.gloss = 0.93;
    material.clearCoat = 0.8;
    material.opacity = 1;
    material.update();
    this.material = material;
    this.entity = new pc.Entity("Continuous flowing bridge gel");
    root.addChild(this.entity);
    this.entity.fluidSurfaceStats = this.stats;
    this.mesh = new pc.Mesh(pc.Application.getApplication().graphicsDevice);
    this.mesh.setPositions([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    this.mesh.setNormals([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    this.mesh.setIndices([0, 1, 2]);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.entity.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.mesh, material)],
      castShadows: true,
    });
  }

  /**
   * @param {Omit<import("./BridgeSlimeFluidLobes.js").FluidLobeOptions,"pc"|"transform"> & {deltaTime:number,loads?:Map<number,{compression:number,bounce:number,across:number,along:number}>}} state
   */
  update(state) {
    this.age += Math.max(0, state.deltaTime);
    const data = bridgeSlimeFluidLobes({
      ...state,
      pc: this.pc,
      transform: this.root.getWorldTransform(),
    });
    this.entity.enabled = data.volume > 0;
    if (!this.entity.enabled) {
      this.#faces([]);

      return;
    }
    if (data.settled && this.bindings && data.volume === this.targetVolume) {
      this.#poseNative(state.nativePoses, state.loads);
      this.#faces([]);

      return;
    }
    this.#faces(data.faces);
    if (this.age < 1 / 12 && data.volume === this.targetVolume) {
      return;
    }
    this.age = 0;
    const began = performance.now();
    const surface = bridgeSlimeImplicitSurface({
      lobes: data.lobes,
      volume: data.volume,
      spacing: 0.12,
      maxCells: 8000,
      smoothPasses: 1,
      initialIsovalue: this.iso,
      maxFits: this.iso ? 3 : 12,
    });
    this.iso = surface.isovalue;
    this.targetVolume = data.volume;
    this.indices = surface.indices;
    this.mesh.setPositions(surface.positions);
    this.mesh.setIndices(surface.indices);
    this.mesh.setNormals(surface.normals ?? this.pc.calculateNormals(surface.positions, surface.indices));
    this.mesh.update(this.pc.PRIMITIVE_TRIANGLES);
    const elapsed = performance.now() - began;
    this.stats.builds++;
    this.stats.totalMs += elapsed;
    this.stats.maxMs = Math.max(this.stats.maxMs, elapsed);
    Object.assign(this.stats, {
      cells: surface.cellCount,
      vertices: surface.positions.length / 3,
      volume: surface.volume,
      targetVolume: data.volume,
      correction: surface.correctionScale,
      lastMs: elapsed,
      transports: data.transports,
    });
    this.bindings = data.settled ? this.#bind(surface.positions, state.nativePoses) : null;
  }

  /**
   * @param {number[]} positions
   * @param {Map<number,import("./BridgeSlimeFluidLobes.js").FluidPose>} poses
   * @returns {Array<{point:import("playcanvas").Vec3,frames:Array<{station:number,origin:import("playcanvas").Vec3,weight:number}>}>}
   */
  #bind(positions, poses) {
    const inverse = this.root.getWorldTransform().clone().invert();
    const frames = [];
    for (const [station, pose] of poses) {
      frames.push({
        station,
        position: inverse.transformPoint(pose.position),
      });
    }
    const bindings = [];
    for (let i = 0; i < positions.length; i += 3) {
      const point = new this.pc.Vec3(positions[i], positions[i + 1], positions[i + 2]);
      const nearest = frames.map(/**
       *
       * @param {{station:number,position:import("playcanvas").Vec3}} frame
       */
        (frame) => ({
          ...frame,
          distance: frame.position.distance(point),
        })).sort(/**
       *
       * @param {{distance:number}} a
       * @param {{distance:number}} b
       */
        (a, b) => a.distance - b.distance).slice(0, 2);
      const total = nearest.reduce(/**
       *
       * @param {number} sum
       * @param {{distance:number}} frame
       */
        (sum, frame) => sum + 1 / Math.max(0.01, frame.distance ** 2), 0);
      bindings.push({
        point,
        frames: nearest.map(/**
       *
       * @param {{station:number,position:import("playcanvas").Vec3,distance:number}} frame
       */
          (frame) => ({
            station: frame.station,
            origin: frame.position,
            weight: 1 / Math.max(0.01, frame.distance ** 2) / total,
          })),
      });
    }

    return bindings;
  }

  /**
   * @param {Map<number,import("./BridgeSlimeFluidLobes.js").FluidPose>} poses
   * @param {Map<number,{compression:number,bounce:number,across:number,along:number}>} [loads]
   */
  #poseNative(poses, loads = new Map()) {
    const signature = [...poses.values()].map(/**
     *
     * @param {import("./BridgeSlimeFluidLobes.js").FluidPose} pose
     */
      (pose) => pose.position.toArray().join(",")).join(";") + JSON.stringify([...loads]);
    if (signature === this.nativeSignature) {
      return;
    }
    this.nativeSignature = signature;
    const inverse = this.root.getWorldTransform().clone().invert();
    const positions = [];
    for (const binding of this.bindings) {
      const point = binding.point.clone();
      for (const frame of binding.frames) {
        const pose = poses.get(frame.station);
        if (pose) {
          point.add(inverse.transformPoint(pose.position).sub(frame.origin).mulScalar(frame.weight));
        }
        const load = loads.get(frame.station);
        if (load) {
          point.y -= Math.max(0, load.compression - load.bounce) * frame.weight * 0.045;
        }
      }
      positions.push(point.x, point.y, point.z);
    }
    this.mesh.setPositions(positions);
    this.mesh.setNormals(this.pc.calculateNormals(positions, this.indices));
    this.mesh.update(this.pc.PRIMITIVE_TRIANGLES);
  }

  /**
   * @param {import("./BridgeSlimeFluidLobes.js").FluidFace[]} faces
   */
  #faces(faces) {
    for (const face of this.faces.values()) {
      for (const part of face) {
        part.enabled = false;
      }
    }
    for (const face of faces) {
      let parts = this.faces.get(face.owner);
      if (!parts) {
        parts = [];
        for (let i = 0; i < 4; i++) {
          const part = new this.pc.Entity(i % 2 ? "Melting dark sensory tip" : "Melting gold sensory stalk");
          this.root.addChild(part);
          const material = new this.pc.StandardMaterial();
          material.diffuse = i % 2 ? new this.pc.Color(0.08, 0.07, 0.03) : new this.pc.Color(1, 0.79, 0.12);
          material.update();
          part.addComponent("render", {
            type: i % 2 ? "sphere" : "cylinder",
            material,
            castShadows: false,
          });
          parts.push(part);
        }
        this.faces.set(face.owner, parts);
      }
      for (let i = 0; i < 4; i++) {
        const part = parts[i];
        part.enabled = true;
        const eye = i % 2;
        const position = face.position.clone();
        position.x += i < 2 ? -0.17 : 0.17;
        position.z += 0.12;
        position.y += (eye ? 0.87 : 0.64) * (1 - face.soft) + 0.13 * face.soft;
        part.setLocalPosition(position);
        const scale = Math.max(0.001, 1 - face.soft);
        part.setLocalScale(eye ? 0.11 * scale : 0.055 * scale, eye ? 0.11 * scale : 0.4 * scale, eye ? 0.11 * scale : 0.055 * scale);
      }
    }
  }

  /**
   * The liquid resolves into the regular bridge only after all flowing donors
   * have finished. Complementary opacity avoids a sudden geometry switch.
   * @param {number} share
   */
  setSettlement(share) {
    this.material.opacity = 1 - share;
    this.material.blendType = share > 0 ? this.pc.BLEND_NORMAL : this.pc.BLEND_NONE;
    this.entity.enabled &&= share < 1;
    this.material.update();
  }

  destroy() {
    for (const face of this.faces.values()) {
      for (const part of face) {
        part.render?.material?.destroy();
        part.destroy();
      }
    }
    this.faces.clear();
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
