import { SLIME_BRIDGE_GROWTH_SECONDS, slimeBridgeTransferProgress } from "./BridgeSlimeTiming.js";
import firstModelUrl from "../../models/bridge/bridge-slime-1.glb?url";
import secondModelUrl from "../../models/bridge/bridge-slime-2.glb?url";
import thirdModelUrl from "../../models/bridge/bridge-slime-3.glb?url";

const GEL_CROSS_SECTION = [[1, 0], [1, 0.65], [0.88, 1], [0, 1], [-0.88, 1], [-1, 0.65], [-1, 0], [-1, -0.65], [-0.88, -1], [0, -1], [0.88, -1], [1, -0.65]];

/**
 * Each station is one living contributor, with authored breathing, blinks and
 * curious gaze. Physics owns the live mass placement and support profile.
 */
export class BridgeSlimeArtwork {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #models;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {Array<{entity: import("playcanvas").Entity, carrier: import("playcanvas").Entity, complete: boolean, direction: import("playcanvas").Vec3, parts: Array<{entity: import("playcanvas").Entity, scale: import("playcanvas").Vec3, position: import("playcanvas").Vec3, delay: number}>, target: import("playcanvas").Vec3, source: import("playcanvas").Vec3, age: number, station: number}>}
   */
  #arrivals = [];
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #entities = [];
  /**
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #flowMaterial = null;
  /**
   * @type {Map<import("playcanvas").Entity, {mesh: import("playcanvas").Mesh, indices: number[]}>}
   */
  #flowMeshes = new Map();
  /**
   * @type {Map<number, {model: import("playcanvas").Entity, wrapper: import("playcanvas").Entity, parts: Array<{entity: import("playcanvas").Entity, position: import("playcanvas").Vec3, scale: import("playcanvas").Vec3}>}>}
   */
  #stations = new Map();
  /**
   * @type {Map<number, {compression: number, bounce: number, across: number, along: number}>}
   */
  #loads = new Map();
  /**
   * Live world-space support poses shared with the physical bridge.
   * @type {Map<number, {position: import("playcanvas").Vec3, start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, connected: boolean, thickness?: number, width?: number, volume?: number, linkedPrevious?: boolean, sections?: Array<{position: import("playcanvas").Vec3, rotation: import("playcanvas").Quat, halfExtents: import("playcanvas").Vec3, volume: number}>, braces?: Array<{id: string, start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, radius: number}>, redistribution?: {progress: number, index: number, count: number, direction: number, startVolume?: number, volumeDelta?: number}|null}>}
   */
  #spanPoses = new Map();
  /**
   * @type {Map<import("playcanvas").Entity, {basePosition: import("playcanvas").Vec3, baseScale: import("playcanvas").Vec3, position: import("playcanvas").Vec3, scale: import("playcanvas").Vec3}>}
   */
  #deformations = new Map();
  /**
   * @type {Map<string, import("playcanvas").Entity>}
   */
  #redistributionFlows = new Map();
  /**
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #redistributionMaterial = null;
  /**
   * @type {Map<string, import("playcanvas").Entity>}
   */
  #braceFlows = new Map();
  /**
   * @type {Map<import("playcanvas").Entity, {base: import("playcanvas").Vec3, applied: import("playcanvas").Vec3}>}
   */
  #detailScales = new Map();
  /**
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #braceMaterial = null;
  /**
   * @type {Map<string, {startDelta: number, startOffset: number, offset: number, progress: number}>}
   */
  #materialTransport = new Map();
  /**
   * @type {Map<number, import("playcanvas").Vec3>}
   */
  #donorSources = new Map();

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [firstModelUrl, secondModelUrl, thirdModelUrl];
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, root: import("playcanvas").Entity}} options
   */
  constructor({ pc, modelLibrary, root }) {
    this.#pc = pc;
    this.#models = modelLibrary;
    this.#root = root;
  }

  /**
   * @param {{definition: import("../ObjectTypes.js").MapObjectDefinition, station: number, position: import("playcanvas").Vec3, startRise?: number, endRise?: number, growing?: boolean, growthAge?: number, sourcePosition?: import("playcanvas").Vec3|null}} options
   */
  addStation({ definition, station, position, startRise = 0, endRise = 0, growing = false, growthAge = 0, sourcePosition = null }) {
    const variation = Math.abs(station * 7 + definition.span.start * 11) % 3;
    const url = BridgeSlimeArtwork.modelUrls[variation];
    const wrapper = new this.#pc.Entity(`Living slime bridge contributor ${station}`);
    this.#root.addChild(wrapper);
    wrapper.setLocalPosition(position);
    wrapper.setLocalEulerAngles(-Math.atan2(endRise - startRise, 1) * 180 / Math.PI, definition.span.horizontal ? 90 : 0, 0);
    const model = this.#models.instantiate(url);
    wrapper.addChild(model);
    model.addComponent("anim", { activate: true });
    const tracks = this.#models.getAnimationTracks(url, ["Alive"]);
    model.anim.addAnimationState("Alive", tracks.get("Alive"), 1, true);
    model.anim.baseLayer.play("Alive");
    model.anim.baseLayer.activeStateCurrentTime = variation * 1.13 + (station % 5) * 0.31;
    model.anim.speed = 0.88 + variation * 0.11;
    this.#entities.push(wrapper);
    const stationParts = [];
    for (const render of model.findComponents("render")) {
      stationParts.push({
        entity: render.entity,
        position: render.entity.getLocalPosition().clone(),
        scale: render.entity.getLocalScale().clone(),
      });
    }
    this.#stations.set(station, {
      model,
      wrapper,
      parts: stationParts,
    });
    if (growing) {
      model.enabled = false;
      const source = sourcePosition ? new this.#pc.Mat4().copy(this.#root.getWorldTransform()).invert().transformPoint(sourcePosition) : position.clone();
      this.#arrivals.push({
        station,
        entity: wrapper,
        carrier: this.#createFlow(null, 25, 24),
        complete: false,
        direction: new this.#pc.Vec3(definition.span.horizontal ? 1 : 0, endRise - startRise, definition.span.horizontal ? 0 : 1).normalize(),
        parts: model.findComponents("render").map(/**
         *
         * @param {import("playcanvas").RenderComponent} render
         * @param {number} index
         */
          (render, index) => ({
            entity: render.entity,
            scale: render.entity.getLocalScale().clone(),
            position: render.entity.getLocalPosition().clone(),
            delay: Math.min(0.45, index * 0.012),
          })),
        source,
        target: position.clone(),
        age: growthAge,
      });
      wrapper.setLocalPosition(source);
      wrapper.setLocalScale(0.27, 1.65, 0.48);
      this.update(0);
    }
  }

  /**
   * A transient connected ribbon carries the travelling mass into its new shape.
   * @param {import("playcanvas").StandardMaterial|null} material
   * @param {number} rings
   * @param {number} sides
   * @returns {import("playcanvas").Entity}
   */
  #createFlow(material = null, rings = 19, sides = 12) {
    if (!this.#flowMaterial) {
      const material = new this.#pc.StandardMaterial();
      material.name = "Stretching live honey mass";
      material.diffuse = new this.#pc.Color(1, 0.79, 0.34);
      material.opacity = 0.56;
      material.blendType = this.#pc.BLEND_NORMAL;
      material.depthWrite = false;
      material.gloss = 0.78;
      material.clearCoat = 0.35;
      material.update();
      this.#flowMaterial = material;
    }
    const flow = new this.#pc.Entity("Continuous rolling gel ribbon");
    const mesh = new this.#pc.Mesh(this.#pc.Application.getApplication().graphicsDevice);
    const indices = [];
    const positions = [];
    for (let ring = 0; ring < rings; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        positions.push(0, 0, 0);
        if (ring < rings - 1) {
          const current = ring * sides + side;
          const next = ring * sides + (side + 1) % sides;
          indices.push(current, current + sides, next, next, current + sides, next + sides);
        }
      }
    }
    for (let vertex = 1; vertex < sides - 1; vertex += 1) {
      indices.push(0, vertex, vertex + 1);
      const end = (rings - 1) * sides;
      indices.push(end, end + vertex + 1, end + vertex);
    }
    mesh.setPositions(positions);
    mesh.setNormals(positions);
    // MeshInstance captures COLOR availability when its shader flags are built.
    // Declare the stream before constructing it, not on the next mesh update.
    mesh.setColors32(new Uint8Array(rings * sides * 4).fill(255));
    mesh.setIndices(indices);
    mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
    flow.addComponent("render", {
      meshInstances: [new this.#pc.MeshInstance(mesh, material ?? this.#flowMaterial)],
      castShadows: false,
    });
    this.#root.addChild(flow);
    this.#flowMeshes.set(flow, {
      mesh,
      indices,
    });

    return flow;
  }

  /**
   * A single closed skin contains the neck and forming body. The neck starts
   * inside the live donor, so the silhouette stays connected on moving support.
   * @param {import("playcanvas").Entity} flow
   * @param {import("playcanvas").Vec3} source
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Vec3} direction
   * @param {import("playcanvas").Vec3} scale
   * @param {number} share
   * @param {number} progress
   */
  #shapeReceivingBody(flow, source, position, direction, scale, share, progress) {
    flow.enabled = share > 0.000001;
    if (!flow.enabled) {
      return;
    }
    const shapeTime = Math.max(0, Math.min(1, (progress - 0.5) / 0.46));
    const shape = shapeTime * shapeTime * (3 - 2 * shapeTime);
    const rise = Math.max(0, Math.min(1, (progress - 0.2) / 0.38));
    const stretch = 1 + Math.sin(rise * Math.PI) * 2.25;
    const cupTime = Math.max(0, Math.min(1, (progress - 0.05) / 0.27));
    const cup = Math.sin(cupTime * Math.PI);
    const width = (0.5 + 0.44 * shape) / Math.sqrt(stretch) * scale.x;
    const height = (0.34 - 0.21 * shape) * stretch * scale.y;
    const depth = 0.5 / Math.sqrt(stretch) * scale.z;
    const reference = Math.abs(direction.y) > 0.95 ? this.#pc.Vec3.RIGHT : this.#pc.Vec3.UP;
    const bodySide = new this.#pc.Vec3().cross(direction, reference).normalize();
    const bodyUp = new this.#pc.Vec3().cross(bodySide, direction).normalize();
    const center = position.clone().add(bodyUp.clone().mulScalar(height * (1 - 2 * shape)));
    const rear = center.clone().add(direction.clone().mulScalar(-depth * 0.85));
    const remaining = Math.cbrt(Math.max(0, 1 - progress));
    const tail = source.clone();
    tail.y += remaining * 0.18;
    const centers = [];
    const sections = [];
    for (let ring = 0; ring < 25; ring += 1) {
      if (ring <= 6) {
        const along = ring / 6;
        centers.push(new this.#pc.Vec3().lerp(tail, rear, along));
        const opening = Math.sin(along * Math.PI / 2);
        const rearSection = Math.sqrt(1 - 0.85 ** 2) * (1 - shape) + shape;
        sections.push({
          x: ((1 - along) * remaining * 0.18 + along * width * rearSection) * opening,
          y: ((1 - along) * remaining * 0.18 + along * height * rearSection) * opening,
          shape: shape * along,
        });
      } else {
        const along = -0.85 + (ring - 6) / 18 * 1.85;
        const profile = Math.sqrt(Math.max(0, 1 - along * along)) * (1 - shape) + shape;
        centers.push(center.clone().add(direction.clone().mulScalar(along * depth)));
        sections.push({
          x: width * profile,
          y: height * profile,
          shape,
        });
      }
    }
    const { mesh, indices } = this.#flowMeshes.get(flow);
    const sides = 24;
    const positions = [];
    const colors = [];
    for (let ring = 0; ring < 25; ring += 1) {
      const tangent = centers[Math.min(24, ring + 1)].clone().sub(centers[Math.max(0, ring - 1)]);
      if (tangent.lengthSq() < 0.000001) {
        tangent.copy(direction);
      }
      tangent.normalize();
      // Transport a common cross-span basis through the neck. Switching from
      // UP to RIGHT near vertical used to create a visible quarter-turn sheet.
      const side = bodySide.clone().sub(tangent.clone().mulScalar(bodySide.dot(tangent)));
      if (side.lengthSq() < 0.000001) {
        side.copy(bodyUp).sub(tangent.clone().mulScalar(bodyUp.dot(tangent)));
      }
      side.normalize();
      const up = new this.#pc.Vec3().cross(side, tangent).normalize();
      const section = sections[ring];
      for (let vertex = 0; vertex < sides; vertex += 1) {
        const angle = vertex / sides * Math.PI * 2;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const boxX = Math.sign(cosine) * Math.abs(cosine) ** 0.65;
        const boxY = sine > 0.8 ? 1 : Math.sign(sine) * Math.abs(sine) ** 0.65;
        const x = (Math.cos(angle) * (1 - section.shape) + boxX * section.shape) * section.x;
        const rim = angle <= Math.PI ? 0.55 * Math.exp(-Math.pow((angle - Math.PI / 4) / 0.32, 2)) + 0.55 * Math.exp(-Math.pow((angle - 3 * Math.PI / 4) / 0.32, 2)) - 0.95 * Math.exp(-Math.pow((angle - Math.PI / 2) / 0.42, 2)) : 0;
        const fold = ring > 6 ? cup * rim : cup * rim * ring / 6;
        const y = (Math.sin(angle) * (1 - section.shape) + boxY * section.shape + fold) * section.y;
        positions.push(centers[ring].x + side.x * x + up.x * y, centers[ring].y + side.y * x + up.y * y, centers[ring].z + side.z * x + up.z * y);
        colors.push(255, 220, 110, 255);
      }
    }
    const targetVolume = 0.94 * 0.13 * 0.5 * 8 * scale.x * scale.y * scale.z * share;
    // Scale cross sections, never the anchored centreline. Iteration handles
    // bent sections without moving the neck away from the physical donor.
    for (let iteration = 0; iteration < 4; iteration += 1) {
      let signedVolume = 0;
      for (let triangle = 0; triangle < indices.length; triangle += 3) {
        const a = indices[triangle] * 3;
        const b = indices[triangle + 1] * 3;
        const c = indices[triangle + 2] * 3;
        signedVolume += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
      }
      const adjust = Math.sqrt(targetVolume / Math.max(0.00000001, Math.abs(signedVolume) / 6));
      for (let vertex = 0; vertex < positions.length; vertex += 3) {
        const anchor = centers[Math.floor(vertex / (sides * 3))];
        positions[vertex] = anchor.x + (positions[vertex] - anchor.x) * adjust;
        positions[vertex + 1] = anchor.y + (positions[vertex + 1] - anchor.y) * adjust;
        positions[vertex + 2] = anchor.z + (positions[vertex + 2] - anchor.z) * adjust;
      }
    }
    mesh.setPositions(positions);
    mesh.setColors32(colors);
    mesh.setNormals(this.#pc.calculateNormals(positions, indices));
    mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const shapes = new Map();
    const poses = new Map(this.#spanPoses);
    for (const arrival of this.#arrivals) {
      if (poses.has(arrival.station)) {
        continue;
      }
      const continuation = this.#continuationPose(arrival.station);
      if (continuation) {
        poses.set(arrival.station, continuation);
      }
    }
    if (poses.size > 0) {
      const inverse = new this.#pc.Mat4().copy(this.#root.getWorldTransform()).invert();
      for (const [station, pose] of poses) {
        const position = inverse.transformPoint(pose.position);
        const start = inverse.transformPoint(pose.start);
        const end = inverse.transformPoint(pose.end);
        const direction = end.clone().sub(start);
        shapes.set(station, {
          position,
          direction: direction.clone().normalize(),
          scale: new this.#pc.Vec3(pose.width ?? 1, pose.thickness ?? 1, Math.max(0.08, direction.length())),
        });
        this.#stations.get(station)?.wrapper.setLocalEulerAngles(
          -Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI,
          Math.atan2(direction.x, direction.z) * 180 / Math.PI,
          0,
        );
      }
    }
    for (const arrival of this.#arrivals) {
      const donor = this.#donorSources.get(arrival.station);
      if (donor) {
        arrival.source = new this.#pc.Mat4().copy(this.#root.getWorldTransform()).invert().transformPoint(donor);
      }
      arrival.age += Math.max(0, deltaTime);
      const t = Math.min(1, arrival.age / SLIME_BRIDGE_GROWTH_SECONDS);
      const travel = Math.min(1, Math.max(0, (t - 0.12) / 0.57));
      const ease = travel * travel * (3 - 2 * travel);
      const shape = shapes.get(arrival.station);
      const target = shape?.position ?? arrival.target;
      const massScale = shape?.scale ?? new this.#pc.Vec3(1, 1, 1);
      const position = new this.#pc.Vec3().lerp(arrival.source, target, ease);
      position.y += Math.sin(travel * Math.PI) * 0.24;
      arrival.entity.setLocalPosition(position);
      const admitted = this.#spanPoses.has(arrival.station);
      const transferred = Math.min(slimeBridgeTransferProgress(arrival.age), admitted ? 1 : 0.999);
      const detail = admitted ? 1 : 0;
      const volumeScale = Math.cbrt(transferred * detail);
      const spread = transferred;
      const settle = Math.sin(Math.max(0, t - 0.68) / 0.32 * Math.PI * 2) * Math.max(0, 1 - t) * 0.18;
      const breadth = 0.75 + 0.25 * spread;
      const height = (1 + settle) / (breadth * breadth);
      const sideScale = breadth / Math.sqrt(1 + settle);
      arrival.entity.setLocalScale(sideScale * volumeScale * massScale.x, height * volumeScale * massScale.y, sideScale * volumeScale * massScale.z);
      for (const part of arrival.parts) {
        const growth = detail;
        const unfold = growth * growth * (3 - 2 * growth);
        const flatten = 0.4 + 0.6 * unfold;
        const widen = 1 / Math.sqrt(flatten);
        part.entity.setLocalScale(part.scale.x * widen, part.scale.y * flatten, part.scale.z * widen);
        part.entity.setLocalPosition(part.position.x * unfold, part.position.y * unfold - 0.12 * (1 - unfold), part.position.z * unfold);
      }
      this.#shapeReceivingBody(arrival.carrier, arrival.source, position, shape?.direction ?? arrival.direction, massScale, transferred * (1 - detail), transferred);
      if (t >= 1 && admitted) {
        arrival.complete = true;
        this.#stations.get(arrival.station).model.enabled = true;
        this.#flowMeshes.get(arrival.carrier).mesh.destroy();
        this.#flowMeshes.delete(arrival.carrier);
        arrival.carrier.destroy();
      }

    }
    this.#arrivals = this.#arrivals.filter(BridgeSlimeArtwork.#stillArriving);
    const growingWrappers = new Set();
    for (const arrival of this.#arrivals) {
      growingWrappers.add(arrival.entity);
    }
    this.#poseRedistributionStreams();
    this.#poseNativeBraces();
    const cableAnchors = this.#suspensionAnchors();
    for (const [station, { wrapper, parts }] of this.#stations) {
      if (growingWrappers.has(wrapper)) {
        continue;
      }
      const shape = shapes.get(station);
      if (shape) {
        wrapper.setLocalPosition(shape.position);
        wrapper.setLocalScale(shape.scale);
      }
      this.#poseSuspension(station, wrapper, parts, cableAnchors);
      this.#poseDetails(station, wrapper, parts);
      const load = this.#loads.get(station);
      const compression = load?.compression ?? 0;
      const bounce = load?.bounce ?? 0;
      for (const part of parts) {
        // Eyes and posts stay on the outboard edge; the walking planks yield
        // locally around the supported foot rather than lowering a whole bridge.
        if (!part.entity.name.startsWith("Gel plank") && !part.entity.name.startsWith("Continuous transparent")) {
          continue;
        }
        const previous = this.#deformations.get(part.entity);
        const currentPosition = part.entity.getLocalPosition().clone();
        const currentScale = part.entity.getLocalScale().clone();
        // Animation can write a fresh pose between updates. Remove only our own
        // previous contribution when it is still present, then add to that pose.
        const basePosition = previous && currentPosition.equals(previous.position) ? previous.basePosition : currentPosition;
        const baseScale = previous && currentScale.equals(previous.scale) ? previous.baseScale : currentScale;
        if (compression === 0 && bounce === 0) {
          if (previous) {
            part.entity.setLocalPosition(basePosition);
            part.entity.setLocalScale(baseScale);
            this.#deformations.delete(part.entity);
          }
          continue;
        }
        const across = part.position.x - (load?.across ?? 0);
        const along = part.position.z - (load?.along ?? 0) * 0.5;
        const influence = Math.exp(-(across * across * 1.05 + along * along * 3.6));
        const dent = compression * influence;
        part.entity.setLocalScale(baseScale.x * (1 + dent * 0.12 + Math.abs(bounce) * influence * 0.045), baseScale.y * (1 - dent * 0.42), baseScale.z * (1 + dent * 0.085 + Math.abs(bounce) * influence * 0.03));
        part.entity.setLocalPosition(basePosition.x, basePosition.y - dent * 0.095 + Math.min(0.018, bounce * influence * 0.055), basePosition.z);
        this.#deformations.set(part.entity, {
          basePosition,
          baseScale,
          position: part.entity.getLocalPosition().clone(),
          scale: part.entity.getLocalScale().clone(),
        });
      }
    }
  }

  /**
   * Follow the free edge while a donation is still travelling, before it owns a body.
   * @param {number} station
   * @returns {{position: import("playcanvas").Vec3, start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, connected: boolean, thickness?: number, width?: number}|null}
   */
  #continuationPose(station) {
    const previous = this.#spanPoses.get(station - 1);
    const neighbor = previous ?? this.#spanPoses.get(station + 1);
    if (!neighbor) {
      return null;
    }
    const direction = neighbor.end.clone().sub(neighbor.start).normalize().mulScalar(previous ? 1 : -1);

    return {
      position: neighbor.position.clone().add(direction),
      start: neighbor.start.clone().add(direction),
      end: neighbor.end.clone().add(direction),
      connected: false,
      thickness: neighbor.thickness,
      width: neighbor.width,
    };
  }

  /**
   * @param {[number, {connected: boolean}]} first
   * @param {[number, {connected: boolean}]} second
   * @returns {number}
   */
  static #stationOrder(first, second) {
    return first[0] - second[0];
  }

  /**
   * Shared cable nodes keep adjacent authored gel rails joined during sway.
   * @returns {Map<number, {start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, side: import("playcanvas").Vec3}>}
   */
  #suspensionAnchors() {
    const anchors = new Map();
    const stations = [...this.#spanPoses].sort(BridgeSlimeArtwork.#stationOrder);
    if (stations.length === 0) {
      return anchors;
    }
    for (const [, pose] of stations) {
      if (!pose.connected) {
        return anchors;
      }
    }
    const direction = stations.at(-1)[1].end.clone().sub(stations[0][1].start);
    const side = new this.#pc.Vec3(direction.z, 0, -direction.x).normalize();
    const nodes = [stations[0][1].start.clone()];
    for (let index = 1; index < stations.length; index += 1) {
      nodes.push(new this.#pc.Vec3().lerp(stations[index - 1][1].end, stations[index][1].start, 0.5));
    }
    nodes.push(stations.at(-1)[1].end.clone());
    for (let index = 0; index < nodes.length; index += 1) {
      const along = index / stations.length;
      nodes[index].y += 0.4 + 0.4 * Math.pow(2 * along - 1, 2);
    }
    for (let index = 0; index < stations.length; index += 1) {
      anchors.set(stations[index][0], {
        start: nodes[index],
        end: nodes[index + 1],
        side,
      });
    }

    return anchors;
  }

  /**
   * Physics supplies the deck; its existing soft rails become cables and hangers.
   * @param {number} station
   * @param {import("playcanvas").Entity} wrapper
   * @param {Array<{entity: import("playcanvas").Entity, position: import("playcanvas").Vec3, scale: import("playcanvas").Vec3}>} parts
   * @param {Map<number, {start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, side: import("playcanvas").Vec3}>} anchors
   */
  #poseSuspension(station, wrapper, parts, anchors) {
    const cable = anchors.get(station);
    if (!cable) {
      for (const part of parts) {
        if (part.entity.name.startsWith("Gel lower rail") || part.entity.name.startsWith("Gel handrail") || part.entity.name.startsWith("Gel railing post")) {
          part.entity.enabled = true;
          part.entity.setLocalPosition(part.position);
          part.entity.setLocalScale(part.scale);
          part.entity.setLocalEulerAngles(0, 0, 0);
        }
      }

      return;
    }
    const inverse = new this.#pc.Mat4().copy(wrapper.getWorldTransform()).invert();
    for (const part of parts) {
      if (part.entity.name.startsWith("Gel lower rail")) {
        part.entity.enabled = false;
      } else if (part.entity.name.startsWith("Gel handrail") || part.entity.name.startsWith("Gel railing post")) {
        const side = Math.sign(part.position.x);
        const offset = cable.side.clone().mulScalar(side);
        const start = inverse.transformPoint(cable.start.clone().add(offset));
        const end = inverse.transformPoint(cable.end.clone().add(offset));
        if (part.entity.name.startsWith("Gel handrail")) {
          const direction = end.clone().sub(start);
          part.entity.setLocalPosition(new this.#pc.Vec3().lerp(start, end, 0.5));
          part.entity.setLocalEulerAngles(-Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI, Math.atan2(direction.x, direction.z) * 180 / Math.PI, 0);
          part.entity.setLocalScale(part.scale.x, part.scale.y, part.scale.z * direction.length() / 1.04);
        } else {
          const along = Math.max(0, Math.min(1, part.position.z + 0.5));
          const upper = new this.#pc.Vec3().lerp(start, end, along);
          const lower = new this.#pc.Vec3(part.position.x, -0.095, part.position.z);
          const direction = upper.clone().sub(lower);
          part.entity.setLocalPosition(new this.#pc.Vec3().lerp(lower, upper, 0.5));
          part.entity.setLocalEulerAngles(Math.atan2(direction.z, direction.y) * 180 / Math.PI, 0, -Math.atan2(direction.x, direction.y) * 180 / Math.PI);
          part.entity.setLocalScale(part.scale.x * 0.55, part.scale.y * direction.length() / 0.65, part.scale.z * 0.55);
        }
      }
    }
  }

  /**
   * The continuous living belly joins the existing gel deck and stringers.
   * Its centreline and cross section directly follow native tissue
   * dimensions and the same preparation clock that moves actual mass.
   */
  #poseRedistributionStreams() {
    for (const [station, { parts }] of this.#stations) {
      for (const part of parts) {
        if (part.entity.name.startsWith("Gel plank") || part.entity.name.startsWith("Continuous transparent underside") || part.entity.name.startsWith("Gel longitudinal stringer")) {
          part.entity.enabled = !this.#spanPoses.has(station);
        }
      }
    }
    const entries = [...this.#spanPoses].filter(/**
     * @param {[number, {redistribution?: object|null}]} entry
     */
      (entry) => Boolean(entry[1])).sort(BridgeSlimeArtwork.#stationOrder);
    const groups = [];
    for (const entry of entries) {
      const group = groups.at(-1);
      const previous = group?.at(-1);
      if (previous && entry[0] === previous[0] + 1 && (entry[1].redistribution?.direction ?? 0) === (previous[1].redistribution?.direction ?? 0) && entry[1].linkedPrevious === true) {
        group.push(entry);
      } else {
        groups.push([entry]);
      }
    }
    const used = new Set();
    if (groups.length > 0) {
      if (!this.#redistributionMaterial) {
        const material = new this.#pc.StandardMaterial();
        material.name = "Continuous living gel body";
        material.diffuse = new this.#pc.Color(1, 0.72, 0.22);
        material.diffuseVertexColor = true;
        material.emissive = new this.#pc.Color(0, 0, 0);
        material.opacity = 1;
        material.opacityVertexColor = true;
        material.blendType = this.#pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.gloss = 0.78;
        material.clearCoat = 0.24;
        material.update();
        this.#redistributionMaterial = material;
      }
      const inverse = new this.#pc.Mat4().copy(this.#root.getWorldTransform()).invert();
      for (const active of groups) {
        const direction = active[0][1].anchorDirection ?? active[0][1].redistribution?.direction ?? 1;
        const bank = direction > 0 ? active[0] : active.at(-1);
        const transfer = bank[1].redistribution;
        const transportKey = `${bank[0]}:${direction}`;
        let transport = this.#materialTransport.get(transportKey);
        if (transfer) {
          if (!transport || transfer.progress < transport.progress) {
            transport = {
              startDelta: transfer.volumeDelta ?? 0,
              startOffset: transport?.offset ?? 0,
              offset: transport?.offset ?? 0,
              progress: transfer.progress,
            };
          }
          // A material marker moves by actual inflow / section volume. The
          // native surface owns the mass and displacement; no visual wave adds
          // a second packet of gel or moves unsupported structure.
          transport.offset = transport.startOffset + direction * ((transfer.volumeDelta ?? 0) - transport.startDelta) / Math.max(0.2, transfer.startVolume ?? bank[1].volume ?? 1);
          transport.progress = transfer.progress;
          this.#materialTransport.set(transportKey, transport);
        } else if (transport) {
          transport.progress = 1;
        }
        const materialOffset = transport?.offset ?? 0;
        const samples = [];
        for (let section = 0; section < active.length; section += 1) {
          const parts = active[section][1].sections;
          const count = parts?.length ?? 1;
          for (let part = 0; part < count; part += 1) {
            const steps = parts ? 8 : 24;
            for (let step = 0; step <= steps; step += 1) {
              samples.push({
                section,
                part,
                along: (part + step / steps) / count,
                native: parts?.[part],
                localAlong: step / steps,
              });
            }
          }
        }
        for (const sign of [0]) {
          const key = `${active[0][0]}:${active.at(-1)[0]}:${sign}:${samples.length}`;
          used.add(key);
          let flow = this.#redistributionFlows.get(key);
          if (!flow) {
            flow = this.#createFlow(this.#redistributionMaterial, samples.length);
            this.#redistributionFlows.set(key, flow);
          }
          const { mesh, indices } = this.#flowMeshes.get(flow);
          const positions = [];
          const colors = [];
          for (const sample of samples) {
            const { section, along, native } = sample;
            const pose = active[section][1];
            const start = inverse.transformPoint(pose.start);
            const end = inverse.transformPoint(pose.end);
            let center = new this.#pc.Vec3().lerp(start, end, along);
            const tangent = end.clone().sub(start).normalize();
            let side = new this.#pc.Vec3(-tangent.z, 0, tangent.x).normalize();
            let up = new this.#pc.Vec3().cross(side, tangent).normalize();
            const neighborIndex = along < 0.5 ? section - 1 : section + 1;
            const neighbor = active[neighborIndex]?.[1];
            const blend = neighbor ? Math.abs(along - 0.5) : 0;
            let width = (pose.width ?? 1) * (1 - blend) + (neighbor?.width ?? pose.width ?? 1) * blend;
            let depth = (pose.thickness ?? 1) * (1 - blend) + (neighbor?.thickness ?? pose.thickness ?? 1) * blend;
            const volume = (pose.volume ?? 1) * (1 - blend) + (neighbor?.volume ?? pose.volume ?? 1) * blend;
            // Native dimensions already concentrate material at the bank and
            // narrow the outgoing span. Join those samples without fake bulges
            // or pointed bank caps that would imply a separate liquid packet.
            let radius = 0.94 * width;
            let height = 0.13 * depth;
            if (native) {
              const worldDirection = pose.end.clone().sub(pose.start).normalize();
              const right = native.rotation.transformVector(this.#pc.Vec3.RIGHT);
              const horizontal = Math.abs(right.dot(worldDirection)) > 0.7;
              const axis = native.rotation.transformVector(horizontal ? this.#pc.Vec3.RIGHT : new this.#pc.Vec3(0, 0, 1));
              const halfLength = horizontal ? native.halfExtents.x : native.halfExtents.z;
              const worldCenter = native.position.clone().add(axis.clone().mulScalar((sample.localAlong - 0.5) * halfLength * 2));
              center = inverse.transformPoint(worldCenter);
              up = inverse.transformVector(native.rotation.transformVector(this.#pc.Vec3.UP)).normalize();
              side = new this.#pc.Vec3().cross(inverse.transformVector(axis).normalize(), up).normalize();
              radius = horizontal ? native.halfExtents.z : native.halfExtents.x;
              height = native.halfExtents.y;
              // Round a change in native child-box size inward to their common
              // intersection. Both sides meet continuously without a fake
              // bulge, a vertical box step or geometry outside the true boxes.
              for (const offset of [-1, 1]) {
                const neighbor = pose.sections[sample.part + offset];
                if (!neighbor) {
                  continue;
                }
                const distance = offset < 0 ? sample.localAlong : 1 - sample.localAlong;
                const t = Math.max(0, Math.min(1, distance / 0.3));
                const edge = 1 - t * t * (3 - 2 * t);
                const nextRadius = horizontal ? neighbor.halfExtents.z : neighbor.halfExtents.x;
                radius -= (radius - Math.min(radius, nextRadius)) * edge;
                height -= (height - Math.min(height, neighbor.halfExtents.y)) * edge;
              }
              width = radius / 0.94;
              depth = height / 0.13;
            }
            center.add(side.clone().mulScalar(sign * width * 0.85));
            // The skin sits on the authored plank tops. Its broad meniscus and
            // recessed seams keep the deck shape readable while exposing gel.
            center.add(up.clone().mulScalar(native ? 0.003 : 0.003 - height));
            const relax = Math.sin((pose.redistribution?.progress ?? 0) * Math.PI);
            const groove = 0.008 * (1 - 0.85 * relax) * Math.exp(-Math.pow(Math.sin(along * Math.PI * 4) * 8, 2));
            const alpha = Math.round(BridgeSlimeArtwork.#sectionOpacity(1.88 * width, 0.26 * depth) * 255);
            const green = Math.max(0.4, Math.min(0.92, 0.67 + (volume - 1) * 1.5));
            for (let vertex = 0; vertex < 12; vertex += 1) {
              const angle = vertex / 12 * Math.PI * 2;
              const cosine = Math.cos(angle);
              const sineValue = Math.sin(angle);
              const cornerX = Math.sign(cosine) * Math.abs(cosine) ** 0.65;
              const cornerY = sineValue > 0.8 ? 1 : Math.sign(sineValue) * Math.abs(sineValue) ** 0.65;
              const progress = pose.redistribution?.progress ?? 0;
              const rounding = Math.sin(progress * Math.PI) * 0.16;
              const shoulder = Math.sin(angle * 2) ** 2;
              const crosswise = cornerX * (1 - rounding * shoulder);
              const sine = cornerY * (1 - rounding * shoulder);
              const radial = crosswise * radius;
              const load = this.#loads.get(active[section][0]);
              const across = radial - (load?.across ?? 0);
              const lengthwise = along - 0.5 - (load?.along ?? 0) * 0.5;
              const contact = Math.exp(-(across * across * 1.05 + lengthwise * lengthwise * 3.6));
              const dent = (load?.compression ?? 0) * contact * 0.065 - Math.min(0.012, (load?.bounce ?? 0) * contact * 0.04);
              const vertical = sine * height;
              const normalOffset = vertical - (sine > 0 ? groove + dent : 0);
              positions.push(center.x + side.x * radial + up.x * normalOffset, center.y + up.y * normalOffset, center.z + side.z * radial + up.z * normalOffset);
              const materialCoordinate = active[section][0] + along + materialOffset;
              const innerHighlight = Math.pow(Math.max(0, Math.sin(materialCoordinate * Math.PI * 2 / 0.75 + cornerX * 1.8)), 3);
              const highlight = innerHighlight * 0.16;
              colors.push(255, Math.round(Math.min(1, green + highlight) * 255), Math.round((0.16 + green * 0.18 + highlight * 0.65) * 255), alpha);
            }
          }
          mesh.setPositions(positions);
          mesh.setColors32(colors);
          mesh.setNormals(this.#pc.calculateNormals(positions, indices));
          mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
        }
      }
    }
    for (const [key, flow] of this.#redistributionFlows) {
      if (!used.has(key)) {
        this.#flowMeshes.get(flow).mesh.destroy();
        this.#flowMeshes.delete(flow);
        flow.destroy();
        this.#redistributionFlows.delete(key);
      }
    }
  }

  /**
   * A deeper native mass profile belongs to the gel, not to its eyes or posts.
   * Keep small details at their authored world size and the eyes inset outboard.
   * @param {number} station
   * @param {import("playcanvas").Entity} wrapper
   * @param {Array<{entity: import("playcanvas").Entity, position: import("playcanvas").Vec3, scale: import("playcanvas").Vec3}>} parts
   */
  #poseDetails(station, wrapper, parts) {
    const pose = this.#spanPoses.get(station);
    if (!pose) {
      return;
    }
    const scale = wrapper.getLocalScale();
    const width = Math.max(0.01, Math.abs(scale.x));
    const depth = Math.max(0.01, Math.abs(scale.y));
    const length = Math.max(0.01, Math.abs(scale.z));
    for (const part of parts) {
      const eye = part.entity.name.startsWith("Watchful eye");
      const glint = part.entity.name.startsWith("Eye catchlight");
      if (eye || glint) {
        const previous = this.#detailScales.get(part.entity);
        const current = part.entity.getLocalScale().clone();
        const base = previous && current.equals(previous.applied) ? previous.base : current;
        part.entity.setLocalScale(base.x / width, base.y / depth, base.z / length);
        part.entity.setLocalPosition(Math.sign(part.position.x) * (0.94 + (eye ? 0.018 : 0.054) / width), part.position.y / depth, part.position.z);
        this.#detailScales.set(part.entity, {
          base,
          applied: part.entity.getLocalScale().clone(),
        });
      } else if (!pose.connected && (part.entity.name.startsWith("Gel handrail") || part.entity.name.startsWith("Gel lower rail") || part.entity.name.startsWith("Gel railing post"))) {
        const post = part.entity.name.startsWith("Gel railing post");
        const lower = part.entity.name.startsWith("Gel lower rail");
        part.entity.enabled = !lower;
        const height = post ? (part.position.y + 0.095) * 0.7 - 0.095 : 0.28;
        part.entity.setLocalPosition(part.position.x, height / depth, part.position.z);
        part.entity.setLocalScale(part.scale.x, part.scale.y * (post ? 0.7 : 1) / depth, part.scale.z);
      }
    }
  }

  /**
   * Temporary triangular braces are the same finite native gel removed from
   * the upper tissue. Their rendered members never invent anchors or lengths.
   */
  #poseNativeBraces() {
    const used = new Set();
    const inverse = new this.#pc.Mat4().copy(this.#root.getWorldTransform()).invert();
    for (const pose of this.#spanPoses.values()) {
      for (const brace of pose.braces ?? []) {
        if (!(brace.radius > 0)) {
          continue;
        }
        const key = String(brace.id);
        used.add(key);
        let flow = this.#braceFlows.get(key);
        if (!flow) {
          if (!this.#braceMaterial) {
            this.#braceMaterial = this.#redistributionMaterial.clone();
            this.#braceMaterial.name = "Readable translucent gel truss";
            this.#braceMaterial.opacity = 1;
            this.#braceMaterial.gloss = 0.82;
            this.#braceMaterial.update();
          }
          flow = this.#createFlow(this.#braceMaterial, 3);
          this.#braceFlows.set(key, flow);
        }
        const start = inverse.transformPoint(brace.start);
        const end = inverse.transformPoint(brace.end);
        const direction = end.clone().sub(start).normalize();
        const reference = Math.abs(direction.y) > 0.95 ? this.#pc.Vec3.RIGHT : this.#pc.Vec3.UP;
        const side = new this.#pc.Vec3().cross(direction, reference).normalize();
        const up = new this.#pc.Vec3().cross(side, direction).normalize();
        const positions = [];
        const colors = [];
        for (let ring = 0; ring < 3; ring += 1) {
          const center = new this.#pc.Vec3().lerp(start, end, ring / 2);
          for (const [x, y] of GEL_CROSS_SECTION) {
            positions.push(center.x + (side.x * x + up.x * y) * brace.radius, center.y + (side.y * x + up.y * y) * brace.radius, center.z + (side.z * x + up.z * y) * brace.radius);
            colors.push(255, 220, 105, Math.round(BridgeSlimeArtwork.#sectionOpacity(brace.radius * 2, brace.radius * 2) * 255));
          }
        }
        const { mesh, indices } = this.#flowMeshes.get(flow);
        mesh.setPositions(positions);
        mesh.setColors32(colors);
        mesh.setNormals(this.#pc.calculateNormals(positions, indices));
        mesh.update(this.#pc.PRIMITIVE_TRIANGLES);
      }
    }
    for (const [key, flow] of this.#braceFlows) {
      if (!used.has(key)) {
        this.#flowMeshes.get(flow).mesh.destroy();
        this.#flowMeshes.delete(flow);
        flow.destroy();
        this.#braceFlows.delete(key);
      }
    }
  }

  /**
   * Dense gel absorbs more light along a thicker real native cross section.
   * @param {number} width
   * @param {number} height
   * @returns {number}
   */
  static #sectionOpacity(width, height) {
    const thickness = Math.max(0, Math.min(width, height));

    return Math.max(0.38, Math.min(0.94, 1 - Math.exp(-thickness * 5)));
  }

  /**
   * @param {{complete: boolean}} arrival
   * @returns {boolean}
   */
  static #stillArriving(arrival) {
    return !arrival.complete;
  }

  /**
   * Keep the rendered neck attached to the donor's live native support motion.
   * @param {Map<number, import("playcanvas").Vec3>} sources
   */
  setDonorSources(sources) {
    this.#donorSources = sources;
  }

  /**
   * @param {Map<number, {compression: number, bounce: number, across: number, along: number}>} loads
   */
  setLoads(loads) {
    this.#loads = loads;
  }

  /**
   * Follow the same settled or drooping span that supplies physical support.
   * @param {Map<number, {position: import("playcanvas").Vec3, start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, connected: boolean, thickness?: number, width?: number, volume?: number, linkedPrevious?: boolean, sections?: Array<{position: import("playcanvas").Vec3, rotation: import("playcanvas").Quat, halfExtents: import("playcanvas").Vec3, volume: number}>, braces?: Array<{id: string, start: import("playcanvas").Vec3, end: import("playcanvas").Vec3, radius: number}>, redistribution?: {progress: number, index: number, count: number, direction: number, startVolume?: number, volumeDelta?: number}|null}>} poses
   */
  setSpanPoses(poses) {
    this.#spanPoses = poses;
  }

  destroy() {
    for (const arrival of this.#arrivals) {
      this.#flowMeshes.get(arrival.carrier)?.mesh.destroy();
      this.#flowMeshes.delete(arrival.carrier);
      arrival.carrier.destroy();

    }
    for (const entity of this.#entities) {
      entity.destroy();
    }
    this.#entities = [];
    this.#arrivals = [];
    for (const flow of this.#redistributionFlows.values()) {
      this.#flowMeshes.get(flow)?.mesh.destroy();
      flow.destroy();
    }
    this.#redistributionFlows.clear();
    for (const flow of this.#braceFlows.values()) {
      this.#flowMeshes.get(flow)?.mesh.destroy();
      flow.destroy();
    }
    this.#braceFlows.clear();
    this.#detailScales.clear();
    this.#materialTransport.clear();
    this.#donorSources.clear();
    this.#braceMaterial?.destroy();
    this.#braceMaterial = null;
    this.#redistributionMaterial?.destroy();
    this.#redistributionMaterial = null;
    this.#flowMaterial?.destroy();
    this.#flowMaterial = null;
    this.#stations.clear();
    this.#loads.clear();
    this.#spanPoses = new Map();
    this.#deformations.clear();
  }
}
