import { FlowerPaperSimulation } from "../../physics/FlowerPaperSimulation.js";
import { splitPaperGeometry } from "./FlowerPaperGeometry.js";

/**
 * @typedef {{name: string, geometry: ReturnType<typeof splitPaperGeometry>, sheet: ReturnType<FlowerPaperSimulation["add"]>|null, attachment: import("playcanvas").Vec3|null}} PaperPart
 * @typedef {{x: number, y: number, z: number, radius: number, compression: number}} PaperGrassContact
 * @typedef {{flower: ReturnType<import("./FlowerPhysics.js").FlowerPhysics["addFlower"]>, url: string, active: boolean, parts: PaperPart[], entity: import("playcanvas").Entity|null, mesh: import("playcanvas").Mesh|null, positions?: Float32Array, normals?: Float32Array, surface?: import("playcanvas").PhysicsBody, grassContact?: PaperGrassContact|null}} PaperFlowerState
 */

const ACTIVE_RADIUS = 2;
const RELEASE_RADIUS = 3;
const MAX_ACTIVE_FLOWERS = 8;
// Retain the readable outward petal spread from the previous contact treatment.
// The attachment stays fixed; the extended sheet itself folds through Ammo.
const PAPER_SPREAD = 1.35;

/**
 * Individual paper-like leaves and petals near the hero; distant flowers keep
 * their existing instanced draw. The owner supplies stem and foot engine poses.
 */
export class FlowerPaper {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #library;
  /**
   * @type {import("playcanvas").Material}
   */
  #material;
  /**
   * @type {import("./FlowerPhysics.js").FlowerPhysics}
   */
  #stem;
  /**
   * @type {FlowerPaperSimulation|null}
   */
  #simulation = null;
  /**
   * @type {PaperFlowerState[]}
   */
  #flowers = [];
  /**
   * @type {{x: number, y: number, z: number}|null}
   */
  #hero = null;
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, library: import("../../models/GameModelLibrary.js").GameModelLibrary, material: import("playcanvas").Material, stem: import("./FlowerPhysics.js").FlowerPhysics}} options
   */
  constructor({ pc, app, library, material, stem }) {
    this.#pc = pc; this.#app = app; this.#library = library; this.#material = material; this.#stem = stem;
    this.#entity = new pc.Entity("Anchored flower paper");
  }

  get entity() { return this.#entity; }

  /**
   * @returns {PaperGrassContact[]}
   */
  get grassSurfaceContacts() {
    return this.#flowers.filter(
      /**
       * @param {PaperFlowerState} item
       */
      (item) => item.active && item.grassContact,
    ).map(
      /**
       * @param {PaperFlowerState} item
       */
      (item) => item.grassContact,
    );
  }

  /**
   * @returns {Array<{name: string, anchor: import("playcanvas").Vec3, links: Array<{position: import("playcanvas").Vec3, rotation: import("playcanvas").Quat}>}>}
   */
  get state() {
    const state = [];
    for (const item of this.#flowers) {
      if (!item.active) { continue; }
      for (const part of item.parts) {
        if (!part.sheet) { continue; }
        const anchor = new this.#pc.Vec3();
        part.sheet.anchor.getTransform(anchor, new this.#pc.Quat());
        const links = [];
        for (const link of part.sheet.links) {
          const position = new this.#pc.Vec3(), rotation = new this.#pc.Quat();
          link.getTransform(position, rotation); links.push({
            position,
            rotation,
          });
        }
        state.push({
          name: part.name,
          anchor,
          links,
        });
      }
    }

    return state;
  }

  /**
   * @param {ReturnType<import("./FlowerPhysics.js").FlowerPhysics["addFlower"]>} flower
   * @param {string} url
   */
  add(flower, url) { this.#flowers.push({
    flower,
    url,
    active: false,
    parts: [],
    entity: null,
    mesh: null,
  }); }

  /**
   * @param {{x: number, y: number, z: number}} position
   */
  updateHero(position) { this.#hero = { ...position }; }

  /**
   * @param {PaperFlowerState} item
   */
  #activate(item) {
    const pc = this.#pc;
    this.#simulation ??= new FlowerPaperSimulation();
    item.surface = this.#simulation.addSurface(item.flower.anchor.getPosition(), item.flower.radius + 0.2);
    const source = this.#library.instantiate(item.url);
    const stemPoints = source.findComponents("render").filter(
      /**
       * @param {import("playcanvas").RenderComponent} render
       */
      (render) => /\bstem\b/i.test(render.entity.name),
    ).map(
      /**
       * @param {import("playcanvas").RenderComponent} render
       */
      (render) => render.entity.getPosition().clone(),
    );
    const pending = [source];
    const rest = new pc.Mat4().setTRS(item.flower.anchor.getPosition(), item.flower.rotation, item.flower.scale);
    const parts = [];
    const combinedIndices = [], colors = [];
    let vertexOffset = 0;
    while (pending.length) {
      const node = pending.pop();
      for (const instance of node.render?.meshInstances ?? []) {
        const positions = [], normals = [], indices = [];
        instance.mesh.getPositions(positions); instance.mesh.getNormals(normals); instance.mesh.getIndices(indices);
        if (!indices.length) { for (let index = 0; index < positions.length / 3; index++) { indices.push(index); } }
        const model = instance.node.getWorldTransform();
        const normalMatrix = new pc.Mat4().copy(model).invert().transpose();
        for (let index = 0; index < positions.length; index += 3) {
          const p = model.transformPoint(new pc.Vec3(...positions.slice(index, index + 3)));
          positions.splice(index, 3, p.x, p.y, p.z);
          const n = normalMatrix.transformVector(new pc.Vec3(...normals.slice(index, index + 3))).normalize();
          normals.splice(index, 3, n.x, n.y, n.z);
        }
        const flexible = /\b(petal|leaf)\b/i.test(node.name);
        let geometry = {
            positions,
            normals,
            indices,
            sections: [],
          }, sheet = null, attachment = null;
        if (flexible) {
          const center = new pc.Vec3();
          for (let index = 0; index < positions.length; index += 3) { center.add(new pc.Vec3(...positions.slice(index, index + 3))); }
          center.mulScalar(3 / positions.length);
          let stem = pc.Vec3.ZERO, nearest = Infinity;
          for (const candidate of stemPoints) {
            const distance = Math.hypot(center.x - candidate.x, center.z - candidate.z);
            if (distance < nearest) { nearest = distance; stem = candidate; }
          }
          const direction = new pc.Vec3(center.x - stem.x, 0, center.z - stem.z).normalize();
          if (direction.lengthSq() < 0.5) { direction.set(1, 0, 0); }
          let minimum = Infinity, maximum = -Infinity, width = 0;
          for (let index = 0; index < positions.length; index += 3) {
            const along = positions[index] * direction.x + positions[index + 2] * direction.z;
            minimum = Math.min(minimum, along); maximum = Math.max(maximum, along);
            width = Math.max(width, Math.abs((positions[index] - center.x) * -direction.z + (positions[index + 2] - center.z) * direction.x));
          }
          const rootDistance = center.x * direction.x + center.z * direction.z - minimum;
          attachment = new pc.Vec3(center.x - direction.x * rootDistance, center.y, center.z - direction.z * rootDistance);
          const worldAttachment = rest.transformPoint(attachment);
          const worldDirection = item.flower.rotation.transformVector(direction);
          const rotation = new pc.Quat().setFromEulerAngles(0, -Math.atan2(worldDirection.z, worldDirection.x) * 180 / Math.PI, 0);
          const inverseRotation = rotation.clone().invert();
          const localPositions = [], localNormals = [];
          for (let index = 0; index < positions.length; index += 3) {
            const p = rest.transformPoint(new pc.Vec3(...positions.slice(index, index + 3))).sub(worldAttachment);
            inverseRotation.transformVector(p, p);
            // Flatten the authored voxel volume into a thin paper surface.
            localPositions.push(p.x * PAPER_SPREAD, p.y * 0.07, p.z * PAPER_SPREAD);
            const n = item.flower.rotation.transformVector(new pc.Vec3(...normals.slice(index, index + 3)));
            inverseRotation.transformVector(n, n);
            localNormals.push(n.x, n.y, n.z);
          }
          const length = Math.max(0.015, (maximum - minimum) * item.flower.scale.x * PAPER_SPREAD);
          geometry = splitPaperGeometry(localPositions, localNormals, indices, length);
          sheet = this.#simulation.add({
            position: worldAttachment,
            rotation,
            length,
            width: Math.max(0.01, width * 2 * item.flower.scale.x * PAPER_SPREAD),
          });
        }
        const color = instance.material.diffuse ?? pc.Color.WHITE;
        for (let vertex = 0; vertex < geometry.positions.length / 3; vertex++) { colors.push(Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255); }
        for (const index of geometry.indices) { combinedIndices.push(vertexOffset + index); }
        parts.push({
          name: node.name,
          geometry,
          sheet,
          attachment,
        });
        vertexOffset += geometry.positions.length / 3;
      }
      pending.push(...node.children);
    }
    source.destroy();
    item.parts = parts;
    item.positions = new Float32Array(vertexOffset * 3); item.normals = new Float32Array(vertexOffset * 3);
    item.mesh = new pc.Mesh(this.#app.graphicsDevice);
    item.mesh.clear(true, false, vertexOffset, combinedIndices.length);
    item.mesh.setPositions(item.positions); item.mesh.setNormals(item.normals); item.mesh.setColors32(colors); item.mesh.setIndices(combinedIndices);
    item.mesh.update(pc.PRIMITIVE_TRIANGLES);
    item.entity = new pc.Entity(`Paper ${item.flower.variant}`);
    const instance = new pc.MeshInstance(item.mesh, this.#material, item.entity);
    instance.castShadow = false; instance.receiveShadow = false;
    item.entity.addComponent("render", {
      meshInstances: [instance],
      castShadows: false,
      receiveShadows: false,
    });
    this.#entity.addChild(item.entity);
    item.active = true;
    item.flower.paperActive = true;
  }

  /**
   * @param {PaperFlowerState} item
   */
  #deactivate(item) {
    for (const part of item.parts) { if (part.sheet) { this.#simulation.remove(part.sheet); } }
    this.#simulation.removeSurface(item.surface);
    item.entity.destroy(); item.mesh.destroy(); item.parts = []; item.active = false;
    item.flower.paperActive = false;
  }

  /**
   * @param {number} deltaTime
   */
  advance(deltaTime) {
    if (!this.#hero) { return; }
    const pc = this.#pc;
    const candidates = this.#flowers.map(
      /**
       * @param {PaperFlowerState} item
       */
      (item) => ({
        item,
        distance: item.flower.anchor.getPosition().distance(new pc.Vec3(this.#hero.x, this.#hero.y, this.#hero.z)),
      }),
    ).filter(
      /**
       * @param {{item: PaperFlowerState, distance: number}} entry
       */
      ({ item, distance }) => !item.flower.hidden && distance < (item.active ? RELEASE_RADIUS : ACTIVE_RADIUS),
    ).sort(
      /**
       * @param {{distance: number}} a
       * @param {{distance: number}} b
       */
      (a, b) => a.distance - b.distance,
    ).slice(0, MAX_ACTIVE_FLOWERS);
    const desired = new Set(candidates.map(
      /**
       * @param {{item: PaperFlowerState}} entry
       */
      ({ item }) => item,
    ));
    for (const item of this.#flowers) {
      if (item.active && !desired.has(item)) { this.#deactivate(item); }
      if (!item.active && desired.has(item)) { this.#activate(item); }
      if (!item.active) { continue; }
      const root = item.flower.anchor.getPosition();
      this.#simulation.moveSurface(item.surface, root);
      const matrix = this.#stem.paperStemMatrix(item.flower);
      for (const part of item.parts) { if (part.sheet) { this.#simulation.moveAttachment(part.sheet, matrix.transformPoint(part.attachment)); } }
    }
    if (!this.#simulation) { return; }
    const feet = this.#stem.footPositions;
    const direction = this.#stem.footDirection;
    const facing = new pc.Quat().setFromEulerAngles(0, Math.atan2(direction[0], direction[1]) * 180 / Math.PI, 0);
    this.#simulation.step(deltaTime, feet, facing);
    for (const item of this.#flowers) { if (item.active) { this.#writeMesh(item, feet, direction); } }
    this.#stem.updateMatrices();
  }

  /**
   * @param {PaperFlowerState} item
   * @param {import("playcanvas").Vec3[]} feet
   * @param {Float32Array} direction
   */
  #writeMesh(item, feet, direction) {
    const pc = this.#pc;
    const matrix = this.#stem.paperStemMatrix(item.flower);
    const root = item.flower.anchor.getPosition();
    const p = new pc.Vec3(), n = new pc.Vec3();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let offset = 0;
    for (const part of item.parts) {
      const poses = part.sheet ? this.#simulation.poses(part.sheet) : [];
      const fold = part.sheet ? poses[0].rotation.transformVector(new pc.Vec3(part.sheet.length / 4, 0, 0)).add(poses[0].position) : null;
      const foldRotation = part.sheet ? new pc.Quat().slerp(poses[0].rotation, poses[1].rotation, 0.5) : null;
      for (let index = 0; index < part.geometry.positions.length; index += 3) {
        p.set(part.geometry.positions[index], part.geometry.positions[index + 1], part.geometry.positions[index + 2]);
        n.set(part.geometry.normals[index], part.geometry.normals[index + 1], part.geometry.normals[index + 2]);
        if (part.sheet) {
          const section = part.geometry.sections[index / 3], pose = poses[section];
          p.x -= part.sheet.length * (section + 0.5) / 2;
          pose.rotation.transformVector(p, p).add(pose.position);
          pose.rotation.transformVector(n, n);
          if (Math.abs(part.geometry.positions[index] - part.sheet.length / 2) < 1e-6) {
            p.set(0, part.geometry.positions[index + 1], part.geometry.positions[index + 2]);
            foldRotation.transformVector(p, p).add(fold);
          }
        } else {
          matrix.transformPoint(p, p); item.flower.rotation.transformVector(n, n);
        }
        // Resolve the first visible frame and delayed contact geometrically.
        // The sheet's fold motion and attachment are entirely Ammo-driven.
        for (const foot of feet) {
          const dx = p.x - foot.x, dz = p.z - foot.z;
          const across = Math.abs(dx * direction[1] - dz * direction[0]) - 0.095;
          const along = Math.abs(dx * direction[0] + dz * direction[1]) - 0.13;
          const outside = Math.max(across, along);
          const sole = foot.y - 0.3;
          if (outside < 0.025 && foot.y + 0.3 > root.y && p.y > sole - 0.0175) {
            const blend = pc.math.smoothstep(0, 0.025, outside);
            p.y = pc.math.lerp(Math.max(root.y + 0.001, sole - 0.0175), p.y, blend);
          }
        }
        p.y = Math.max(root.y + 0.001, p.y);
        if (part.sheet && p.y < root.y + 0.025) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        }
        item.positions[offset] = p.x; item.positions[offset + 1] = p.y; item.positions[offset + 2] = p.z;
        item.normals[offset] = n.x; item.normals[offset + 1] = n.y; item.normals[offset + 2] = n.z;
        offset += 3;
      }
    }
    // Paper resting on the surface parts the grass underneath its footprint.
    // Otherwise the thin sheet is correctly folded but disappears in blades.
    item.grassContact = Number.isFinite(minX) ? {
      x: (minX + maxX) / 2,
      y: root.y,
      z: (minZ + maxZ) / 2,
      radius: Math.min(0.4, Math.hypot(maxX - minX, maxZ - minZ) / 2 + 0.02),
      compression: 0.075,
    } : null;
    item.mesh.setPositions(item.positions); item.mesh.setNormals(item.normals); item.mesh.update(pc.PRIMITIVE_TRIANGLES);
  }

  destroy() {
    for (const item of this.#flowers) { if (item.active) { this.#deactivate(item); } }
    this.#simulation?.destroy(); this.#entity.destroy(); this.#flowers = [];
  }
}
