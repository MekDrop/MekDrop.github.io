import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";
import { AXE_HIT_STOP_DURATION } from "../../config/axe.js";

/**
 * A severed crown with one Ammo body. Its lifetime starts at terrain contact.
 */
export class FallenTree {
  /**
   * @type {import("playcanvas").Entity}
   */
  #body;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {number|null}
   */
  #groundAge = null;
  /**
   * @type {number}
   */
  #releaseRemaining = AXE_HIT_STOP_DURATION;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #forward;
  /**
   * @type {import("playcanvas").EventHandle[]}
   */
  #handles = [];

  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,source:import("playcanvas").Entity,parts:import("playcanvas").Entity[],voxels:Array<{x:number,y:number,z:number,width:number,height:number,depth:number}>,direction:{x:number,z:number}}} options
   */
  constructor({ pc, app, source, parts, voxels, direction }) {
    this.#app = app;
    const parent = source.parent;
    const pivot = new pc.Entity("Fallen tree origin");
    this.#root = pivot;
    parent.addChild(pivot);
    pivot.setPosition(source.getPosition());
    pivot.setRotation(source.getRotation());
    const centerY = voxels.reduce(/**
     *
     * @param {number} sum
     * @param {{x:number,y:number,z:number,width:number,height:number,depth:number}} voxel
     */
      (sum, voxel) => sum + voxel.y, 0) / voxels.length;
    this.#body = addGeneratedVoxelPhysics({
      pc,
      parent: pivot,
      name: "Fallen tree",
      voxels: voxels.map(/**
       *
       * @param {{x:number,y:number,z:number,width:number,height:number,depth:number}} voxel
       */
        voxel => ({
          ...voxel,
          y: voxel.y - centerY,
        })),
      friction: 0.8,
    });
    this.#body.setLocalPosition(0, centerY, 0);
    this.#body.tags.add("batch-ignore");
    for (const part of parts) {
      const clone = part.clone();
      this.#body.addChild(clone);
      clone.setPosition(part.getPosition());
      clone.setRotation(part.getRotation());
      clone.setLocalScale(part.getWorldTransform().getScale());
      for (const render of clone.findComponents("render")) {
        render.batchGroupId = -1;
      }
    }
    const rotation = source.getRotation();
    const forward = rotation.transformVector(new pc.Vec3(-direction.x, 0, -direction.z));
    this.#forward = forward;
    this.#body.rigidbody.mass = 3;
    this.#body.rigidbody.linearDamping = 0.1;
    this.#body.rigidbody.angularDamping = 0.2;
    this.#handles.push(this.#body.rigidbody.on("collisionstart", this.#contact, this));
    this.#handles.push(this.#app.on("update", this.#update, this));
    pivot.once("destroy", this.#dispose, this);
  }

  /**
   * @param {import("playcanvas").CollisionResult} result
   */
  #contact(result) {
    if (result.other?.tags.has("terrain-physics-surface") && result.contacts.some(FallenTree.#isGroundContact)) {
      this.#groundAge ??= 0;
    }
  }

  /**
   * @param {import("playcanvas").ContactPoint} contact
   * @returns {boolean}
   */
  static #isGroundContact(contact) {
    return Math.abs(contact.normal.y) > 0.5;
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    if (this.#releaseRemaining > 0) {
      this.#releaseRemaining = this.#releaseRemaining <= dt + 1e-8
        ? 0 : this.#releaseRemaining - dt;
      if (this.#releaseRemaining === 0) {
        const forward = this.#forward;
        this.#body.rigidbody.type = "dynamic";
        this.#body.rigidbody.applyImpulse(forward.x * 1.2, 0, forward.z * 1.2);
        this.#body.rigidbody.applyTorqueImpulse(forward.z * 1.5, 0, -forward.x * 1.5);
      }

      return;
    }
    if (this.#groundAge !== null) {
      this.#groundAge += dt;
      if (this.#groundAge >= 4) {
        this.#root.destroy();
      }
    }
  }

  #dispose() {
    for (const handle of this.#handles) {
      handle.off();
    }
    this.#handles = [];
  }
}
