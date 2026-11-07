/**
 * Tread contacts and quiet footfalls. Ammo owns the capsule; the rigid feet
 * follow its measured support without changing their shape or tripod timing.
 */
import { BellBugCalibration } from "./BellBugCalibration.js";

export class BellBugGroundPose {
  /**
   * @type {import("./BellBug.js").BellBug}
   */
  owner;
  /**
   * @type {import("playcanvas").Entity}
   */
  model;
  /**
   * @type {number|null}
   */
  height;
  /**
   * @type {Array<{bone:import("playcanvas").GraphNode,mesh:import("playcanvas").MeshInstance,original:import("playcanvas").Vec3|null,index:number,restHeight:number,lifted:boolean}>}
   */
  legs;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  poseHandle;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  restoreHandle;
  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.model = model;
    this.height = null;
    this.legs = [];
    for (const side of ["L", "R"]) {
      for (let index = 0; index < 3; index++) {
        const bone = model.findByName?.(`leg_${side}_${index}`);
        const mesh = model.findByName?.(`BellBug leg ${side}${index}`)?.findComponents("render")[0]?.meshInstances[0];
        if (bone && mesh) {
          this.legs.push({
            bone,
            mesh,
            original: null,
            index:this.legs.length,
            restHeight:bone.getLocalPosition().y,
            lifted:false,
          });
        }
      }
    }
    // Application emits prerender, not postupdate. Animation and Ammo have
    // finished here, so both the feet and their sound use the rendered contact.
    this.poseHandle = owner.app.on("prerender", this.#pose, this);
    this.restoreHandle = owner.app.on("postrender", this.#restore, this);
  }

  #restore() {
    for (const leg of this.legs) {
      if (leg.original) {
        leg.bone.setLocalPosition(leg.original);
      }
      leg.original = null;
    }
  }

  /**
   * @param {number} dt
   */
  #pose(dt) {
    this.#restore();
    const b = this.owner, p = b.position;
    if (!this.legs.length || !p) {
      return;
    }
    const walking = b.stateName === "BellBugPursueState" &&
      (b.clip === "scuttle_walk" || b.clip === "scuttle_run") &&
      b.grounded && !b.airborne && !b.carrier;
    if (!walking) {
      for (const leg of this.legs) {
        leg.lifted = false;
      }
      this.model.setLocalPosition(this.model.getLocalPosition().x, BellBugCalibration.y, BellBugCalibration.z);
      this.height = null;

      return;
    }
    const contacts = [];
    let total = 0;
    let highest = -Infinity;
    for (const leg of this.legs) {
      const center = leg.mesh.aabb.center;
      const hit = b.stepSupport.surface(center.x, center.z, p.y + 0.34, p.y - 0.65);
      const clearance = leg.bone.getLocalPosition().y-leg.restHeight;
      if (clearance>0.006) {
        leg.lifted = true;
      } else if (clearance<=0.001 && leg.lifted) {
        leg.lifted = false;
        const velocity = b.entity.rigidbody?.linearVelocity;
        if (hit && b.alive && velocity && Math.hypot(velocity.x,velocity.z)>0.025) {
          b.playFootstep?.(leg.index,hit.point);
        }
      }
      const height = hit?.point.y ?? p.y - BellBugCalibration.groundClearance;
      contacts.push({
        leg,
        height,
      });
      total += height;
      highest = Math.max(highest, height);
    }
    const ground = total / contacts.length;
    const desired = Math.max(p.y - 0.32, Math.min(p.y + 0.12, ground + BellBugCalibration.groundClearance));
    this.height ??= desired;
    this.height += (desired - this.height) * (1 - Math.exp(-18 * (dt || 1 / 60)));
    // Keep the bell above the highest planted foot. Averaging tread heights
    // alone pulled its rim down over uphill feet on the next riser.
    this.height = Math.max(this.height, highest + BellBugCalibration.groundClearance);
    const offset = Math.max(-0.32, Math.min(0.34, this.height - p.y));
    this.model.setLocalPosition(0, BellBugCalibration.y + offset, BellBugCalibration.z);
    for (const {leg, height} of contacts) {
      leg.original = leg.bone.getLocalPosition().clone();
      // Keep the clip's swing clearance; only replace its flat support plane.
      const world = leg.bone.getPosition().clone();
      world.y += Math.max(-0.34, Math.min(0, height + BellBugCalibration.groundClearance - p.y - offset));
      const local = leg.bone.parent.getWorldTransform().clone().invert().transformPoint(world);
      leg.bone.setLocalPosition(local);
    }
  }

  destroy() {
    this.#restore();
    this.poseHandle.off();
    this.restoreHandle.off();
  }
}
