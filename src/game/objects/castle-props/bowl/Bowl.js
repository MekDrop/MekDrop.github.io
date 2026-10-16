import modelUrl from "../../../models/bowl/bowl.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { BowlPacking } from "./BowlPacking.js";

/**
 * One reusable bowl with an independently authored collection of contained items.
 */
export class Bowl extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #items = [];
  /**
   * @type {ConstructorParameters<typeof AbstractCastleProp>[0]}
   */
  #options;
  /**
   * @type {boolean}
   */
  #packed = false;
  /**
   * @type {Map<import("playcanvas").Mesh, import("playcanvas").Mesh>}
   */
  #meshes = new Map();
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    this.#options = options;
  }

  onSceneReady() {
    if (this.#packed) {
      return;
    }
    const model = this.visualRoots[0].children[0];
    const shell = BowlPacking.geometry(model, model);
    const geometries = [];
    const packedItems = [];
    const { runtime, definition } = this.#options;
    for (const [index, item] of (definition.items ?? []).entries()) {
      const object = runtime.createObject({
        ...item,
        id: `${definition.id}-item-${index}`,
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        rotation: item.rotation ?? 0,
      });
      model.addChild(object.entity);
      object.onSceneReady?.();
      // Retain a frozen visual snapshot and release the original object's behavior,
      // listeners and main-world physics. Packing only owns temporary Ammo bodies.
      const contents = object.entity.clone();
      this.#items.push(contents);
      try {
        for (const render of contents.findComponents("render")) {
          render.batchGroupId = -1;
          for (const mesh of render.meshInstances) {
            mesh.material = this.cloneMaterial(mesh.material);
            mesh.mesh = this.#snapshotMesh(mesh.mesh);
          }
        }
      } finally {
        object.destroy();
      }
      for (const component of contents.findComponents("rigidbody")) {
        component.entity.removeComponent("rigidbody");
      }
      for (const component of contents.findComponents("collision")) {
        component.entity.removeComponent("collision");
      }
      for (const type of ["anim", "animation", "script", "sound", "audiolistener", "camera", "light"]) {
        for (const component of contents.findComponents(type)) {
          component.entity.removeComponent(type);
        }
      }
      model.addChild(contents);
      if (item.position) {
        // Explicit local placement preserves authored arrangements when splitting assets.
        contents.setLocalPosition(item.position.x, item.position.y, item.position.z);
        continue;
      }
      if (item.scale === undefined) {
        const geometry = BowlPacking.geometry(contents, model);
        const size = geometry.bounds.halfExtents;
        const target = Math.min(shell.bounds.halfExtents.x, shell.bounds.halfExtents.z) * 0.48;
        const fit = target / (2 * Math.max(size.x, size.y, size.z));
        contents.setLocalScale(fit, fit, fit);
      }
      geometries.push(BowlPacking.geometry(contents, model));
      packedItems.push(contents);
    }
    const poses = geometries.length ? BowlPacking.settle(shell, geometries) : [];
    for (const [index, pose] of poses.entries()) {
      // Numeric components also work when the solver and renderer were loaded
      // from different Engine entry points and have distinct Vec3/Quat classes.
      packedItems[index].setLocalPosition(pose.position.x, pose.position.y, pose.position.z);
      packedItems[index].setLocalRotation(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
    }
    this.#packed = true;
    super.onSceneReady();
  }

  destroy() {
    for (const item of this.#items) {
      item.destroy();
    }
    this.#items = [];
    super.destroy();
    for (const mesh of this.#meshes.values()) {
      mesh.destroy();
    }
    this.#meshes.clear();
  }

  /**
   * Procedural objects may destroy their own buffers, so snapshots own a copy.
   * Repeated instances of the same source mesh share that copy within the bowl.
   * @param {import("playcanvas").Mesh} source
   * @returns {import("playcanvas").Mesh}
   */
  #snapshotMesh(source) {
    if (this.#meshes.has(source)) {
      return this.#meshes.get(source);
    }
    const mesh = new this.#options.pc.Mesh(source.device);
    for (const element of source.vertexBuffer.format.elements) {
      const values = [];
      source.getVertexStream(element.name, values);
      mesh.setVertexStream(element.name, values, element.numComponents,
        source.vertexBuffer.numVertices, element.dataType, element.normalize, element.asInt);
    }
    const indices = [];
    source.getIndices(indices);
    if (indices.length) {
      mesh.setIndices(indices);
    }
    mesh.update(source.primitive[0].type);
    this.#meshes.set(source, mesh);

    return mesh;
  }

  /**
   * Tint only the shell; imported tile shading remains intact.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (collision || !this.definition.color) {
      return;
    }
    for (const render of model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        const material = this.cloneMaterial(mesh.material);
        const tint = material.diffuse.clone().fromString(this.definition.color);
        material.diffuse.set(material.diffuse.r * tint.r,
          material.diffuse.g * tint.g, material.diffuse.b * tint.b);
        material.update();
        mesh.material = material;
      }
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }

}
