import cliffVineModelUrl from "../../models/vegetation/cliff-vine.glb?url";
import { createCliffVineLayout } from "./CliffVineLayout.js";

/** Repeated authored vine modules fitted to generated exposed cliff faces. */
export class CliffVines {
  static modelUrls = [cliffVineModelUrl];

  #entity;
  #vertexBuffer = null;

  constructor({ pc, mapData, modelLibrary }) {
    this.#entity = new pc.Entity("Cliff vines");
    const matrices = [];
    const position = new pc.Vec3();
    const rotation = new pc.Quat();
    const scale = new pc.Vec3();
    const matrix = new pc.Mat4();
    for (const module of createCliffVineLayout(mapData)) {
      position.set(module.x, module.y, module.z);
      rotation.setFromEulerAngles(0, module.yaw, 0);
      scale.set(module.scaleX, module.scaleY, module.scaleZ);
      matrix.setTRS(position, rotation, scale);
      matrices.push(...matrix.data);
    }
    if (!matrices.length) {
      return;
    }
    const batch = modelLibrary.instantiateMergedBatch(
      cliffVineModelUrl,
      matrices,
      { name: "Instanced cliff vine modules" },
    );
    if (batch) {
      this.#vertexBuffer = batch.vertexBuffer;
      this.#entity.addChild(batch.entity);
    }
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#vertexBuffer?.destroy();
    this.#vertexBuffer = null;
  }
}
