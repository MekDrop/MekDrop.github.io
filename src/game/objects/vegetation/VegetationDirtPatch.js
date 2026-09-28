import { buildVegetationDirtPatchGeometry } from "./VegetationDirtPatchGeometry.js";
import { VegetationDirtPatchLayout } from "./VegetationDirtPatchLayout.js";

const PATCH_HEIGHT = 0.014;

export class VegetationDirtPatch {
  #entity;
  #layout;
  #mesh;
  #material;

  constructor({ pc, app, id, footprint, x, y, z, rotation = 0 }) {
    const geometry = buildVegetationDirtPatchGeometry(footprint, id);
    this.#layout = new VegetationDirtPatchLayout({
      outline: geometry.outline,
      x,
      y,
      z,
      rotation,
    });

    this.#entity = new pc.Entity(`Vegetation dirt patch ${id}`);
    this.#entity.name = `Vegetation dirt patch ${id}`;
    this.#entity.setLocalPosition(x, y + PATCH_HEIGHT, z);
    this.#entity.setLocalEulerAngles(0, rotation, 0);
    this.#mesh = new pc.Mesh(app.graphicsDevice);
    this.#mesh.setPositions(geometry.positions);
    this.#mesh.setNormals(geometry.normals);
    this.#mesh.setColors32(geometry.colors);
    this.#mesh.setIndices(geometry.indices);
    this.#mesh.update();
    this.#material = new pc.StandardMaterial();
    this.#material.name = "Vegetation dirt scar";
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseVertexColor = true;
    this.#material.gloss = 0.04;
    this.#material.metalness = 0;
    this.#material.useMetalness = true;
    this.#material.update();
    const meshInstance = new pc.MeshInstance(this.#mesh, this.#material);
    this.#entity.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: true,
    });
  }

  get entity() {
    return this.#entity;
  }

  grassWeightAt(x, z, elevation) {
    return this.#layout.grassWeightAt(x, z, elevation);
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#mesh?.destroy();
    this.#mesh = null;
    this.#material?.destroy();
    this.#material = null;
  }
}
