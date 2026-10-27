import { BridgeRailingKit } from "./BridgeRailingKit.js";
import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";

/**
 * @typedef {{position:import("playcanvas").Vec3, rotation:import("playcanvas").Quat, velocity:import("playcanvas").Vec3, contactPoint?:import("playcanvas").Vec3}} BridgeGroundImpact
 */

/**
 * One original deck station, including its attached railings. Two point joints
 * form a transverse hinge; Ammo owns the fall and the pull on the next station.
 */
export class BridgeDeckFragment {
  /**
   * @type {import("playcanvas").Entity}
   */
  entity;
  /**
   * @type {number}
   */
  age = 0;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {boolean}
   */
  #horizontal;
  /**
   * @type {number}
   */
  #initialHeight;
  /**
   * @type {number}
   */
  #variation;
  /**
   * @type {TerrainInstanceRenderer}
   */
  #deck;
  /**
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #buffers = [];
  /**
   * @type {Array<{ammo: typeof globalThis.Ammo, world: import("sync-ammo/dist/ammo").btDiscreteDynamicsWorld, constraint: import("sync-ammo/dist/ammo").btPoint2PointConstraint}>}
   */
  #constraints = [];
  /**
   * @type {BridgeDeckFragment|null}
   */
  #connectedTo = null;
  /**
   * @type {Set<BridgeDeckFragment>}
   */
  #supporters = new Set();
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {number}
   */
  #opacity = 1;
  /**
   * @type {Map<import("playcanvas").Material, import("playcanvas").Material>}
   */
  #fadeMaterials = new Map();
  /**
   * @type {Map<import("playcanvas").MeshInstance, import("playcanvas").Material>}
   */
  #fadeAssignments = new Map();
  /**
   * @type {number}
   */
  #station;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #contactHandle = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #velocityHandle = null;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #lastVelocity;
  /**
   * @type {BridgeGroundImpact|null}
   */
  #pendingImpact = null;
  /**
   * @type {boolean}
   */
  #hasImpacted = false;

  /**
   * The root enters the live world before constraints are attached. Its owner
   * may reparent it beneath an identity scene root; all artwork stays local.
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, materials: import("playcanvas").Material[], definition: import("../ObjectTypes.js").MapObjectDefinition, station: number, position: import("playcanvas").Vec3}} options
   */
  constructor({ pc, app, modelLibrary, materials, definition, station, position }) {
    this.#pc = pc;
    this.#app = app;
    this.#station = station;
    this.#lastVelocity = new pc.Vec3();
    this.#horizontal = definition.span.horizontal;
    this.#initialHeight = position.y - 0.12;
    this.#variation = Math.sin(station * 12.9898 + definition.span.start * 7.233);
    this.entity = new pc.Entity(`Falling bridge deck ${station}`);
    this.entity.tags.add("hero-surface-ignore");
    this.entity.setPosition(position.x, this.#initialHeight, position.z);
    app.root.addChild(this.entity);
    this.#deck = new TerrainInstanceRenderer({
      pc,
      app,
      root: this.entity,
      materials,
    });
    const width = this.#horizontal ? 1 : 2;
    const depth = this.#horizontal ? 2 : 1;
    this.#deck.addBoxMatrix("path", definition.material, 0, 0, 0, 0,
      width, 0.24, depth, "surfaceOnly", "none");
    this.#deck.addBoxMatrix("path", definition.material, 0, 0, 0, 0,
      width, 0.24, depth,
      this.#horizontal ? "bridgeHorizontalSidesOnly" : "bridgeVerticalSidesOnly", definition.material);
    // The newly exposed fracture ends close the slab once it rotates away
    // from its neighbour. Its original long fascia and underside stay intact.
    this.#deck.addBoxMatrix("none", definition.material, 0, 0, 0, 0,
      width, 0.24, depth,
      this.#horizontal ? "bridgeVerticalSidesOnly" : "bridgeHorizontalSidesOnly", "none");
    this.#deck.build();
    const railings = new BridgeRailingKit({
      pc,
      modelLibrary,
      root: this.entity,
    });
    const start = station === definition.span.start ? -0.34 : -0.5;
    const end = station === definition.span.end ? 0.34 : 0.5;
    this.entity.addComponent("collision", { type: "compound" });
    this.#addCollider("Original deck slab", new pc.Vec3(), new pc.Vec3(width / 2, 0.12, depth / 2));
    const endPost = station === definition.span.end;
    this.#addRailing(railings, definition.material, start, end, -0.93, endPost);
    this.#addRailing(railings, definition.material, start, end, 0.93, endPost);
    this.#buffers = railings.build();
    this.entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 8 + this.#variation * 0.35,
      friction: 0.65,
      restitution: 0.03,
      linearDamping: 0.06,
      angularDamping: 0.12,
      group: pc.BODYGROUP_USER_1,
      mask: pc.BODYMASK_STATIC | pc.BODYGROUP_USER_1,
    });
    // Small asymmetry breaks perfectly repeated motion without throwing the
    // stations outward. Their weight and connected hinges drive the collapse.
    this.entity.rigidbody.applyTorqueImpulse(
      this.#horizontal ? this.#variation * 0.018 : this.#variation * 0.035,
      this.#variation * 0.012,
      this.#horizontal ? this.#variation * 0.035 : -this.#variation * 0.018,
    );
    this.#contactHandle = this.entity.rigidbody.on?.("contact", this.#onContact, this) ?? null;
    this.#velocityHandle = app.on?.("update", this.#rememberVelocity, this) ?? null;
  }

  /**
   * @returns {number}
   */
  get station() {
    return this.#station;
  }

  #rememberVelocity() {
    const velocity = this.entity.rigidbody?.linearVelocity;
    if (velocity) {
      this.#lastVelocity.copy(velocity);
    }
  }

  /**
   * Queue only a genuine lower-floor impact; never mutate bodies in a contact
   * callback. Contact normals have either sign in PlayCanvas' reverse results.
   * @param {import("playcanvas").ContactResult} result
   */
  #onContact(result) {
    if (this.#destroyed || this.#hasImpacted || this.age < 0.1) {
      return;
    }
    let other = result.other;
    while (other && !other.rigidbody) {
      other = other.parent;
    }
    if (other?.rigidbody?.type !== "static") {
      return;
    }
    const fall = Math.max(this.#initialHeight - this.entity.getPosition().y,
      this.freeEdgeDrop(-1), this.freeEdgeDrop(1));
    if (fall < 0.12) {
      return;
    }
    const contact = result.contacts?.find(this.#isFloorContact.bind(this));
    if (!contact) {
      return;
    }
    const current = this.entity.rigidbody.linearVelocity ?? new this.#pc.Vec3();
    const velocity = this.#lastVelocity.y < current.y ? this.#lastVelocity : current;
    this.#pendingImpact = {
      position: this.entity.getPosition().clone(),
      rotation: this.entity.getRotation().clone(),
      velocity: velocity.clone(),
      contactPoint: (contact.pointOther ?? contact.point).clone(),
    };
    this.#hasImpacted = true;
  }

  /**
   * @param {import("playcanvas").ContactPoint} contact
   * @returns {boolean}
   */
  #isFloorContact(contact) {
    const point = contact.pointOther ?? contact.point;

    return Math.abs(contact.normal.y) > 0.55 && Number.isFinite(point?.y) && point.y < this.#initialHeight - 0.14;
  }

  /**
   * The owner consumes this after advancing the structural collapse fronts.
   * @returns {BridgeGroundImpact|null}
   */
  consumeGroundImpact() {
    const impact = this.#pendingImpact;
    this.#pendingImpact = null;

    return impact;
  }

  /**
   * @param {string} name
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Vec3} halfExtents
   */
  #addCollider(name, position, halfExtents) {
    const collider = new this.#pc.Entity(name);
    collider.setLocalPosition(position);
    collider.addComponent("collision", {
      type: "box",
      halfExtents,
    });
    this.entity.addChild(collider);
  }

  /**
   * @param {BridgeRailingKit} railings
   * @param {string} material
   * @param {number} start
   * @param {number} end
   * @param {number} across
   * @param {boolean} endPost
   */
  #addRailing(railings, material, start, end, across, endPost) {
    const pc = this.#pc;
    railings.addRailing({
      position: new pc.Vec3(this.#horizontal ? start : across, 0.12, this.#horizontal ? across : start),
      direction: new pc.Vec3(this.#horizontal ? 1 : 0, 0, this.#horizontal ? 0 : 1),
      length: end - start,
      postSpacing: 1,
      material,
      endPost,
    });
    const center = (start + end) / 2;
    this.#addCollider("Attached timber railing",
      new pc.Vec3(this.#horizontal ? center : across, 0.38, this.#horizontal ? across : center),
      new pc.Vec3(this.#horizontal ? (end - start) / 2 : 0.06, 0.26, this.#horizontal ? 0.06 : (end - start) / 2));
  }

  /**
   * @returns {boolean}
   */
  get hasSupport() {
    return this.#constraints.length > 0;
  }

  /**
   * @returns {number}
   */
  get opacity() {
    return this.#opacity;
  }

  /**
   * Clone only when fading starts: intact shared terrain and timber materials
   * must never inherit a fragment's transparency.
   * @param {number} value
   */
  set opacity(value) {
    if (this.#destroyed || !Number.isFinite(value)) {
      return;
    }
    this.#opacity = Math.min(1, Math.max(0, value));
    if (this.#opacity === 1) {
      this.#releaseFadeMaterials();

      return;
    }
    if (!this.#fadeMaterials.size) {
      for (const render of this.entity.findComponents("render")) {
        for (const instance of render.meshInstances) {
          const original = instance.material;
          if (!original) {
            continue;
          }
          let material = this.#fadeMaterials.get(original);
          if (!material) {
            material = original.clone();
            material.blendType = this.#pc.BLEND_NORMAL;
            material.depthWrite = false;
            this.#fadeMaterials.set(original, material);
          }
          this.#fadeAssignments.set(instance, original);
          instance.material = material;
        }
      }
    }
    for (const material of this.#fadeMaterials.values()) {
      material.opacity = this.#opacity;
      material.update();
    }
  }

  #releaseFadeMaterials() {
    for (const [instance, original] of this.#fadeAssignments) {
      instance.material = original;
    }
    this.#fadeAssignments.clear();
    for (const material of this.#fadeMaterials.values()) {
      material.destroy();
    }
    this.#fadeMaterials.clear();
  }

  /**
   * Hold the far edge, leaving the edge toward the missing neighbor free.
   * @param {number} direction Station travel direction, -1 or 1.
   * @returns {boolean}
   */
  anchor(direction) {
    this.releaseSupport();
    const attached = this.#attachPair(null, direction);
    if (attached) {
      const velocity = this.entity.rigidbody.angularVelocity.clone();
      const initialTurn = 0.07 + this.#variation * 0.015;
      velocity.add(new this.#pc.Vec3(this.#horizontal ? 0 : -direction * initialTurn,
        this.#variation * 0.005, this.#horizontal ? direction * initialTurn : 0));
      this.entity.rigidbody.angularVelocity = velocity;
    }

    return attached;
  }

  /**
   * Turn the old world support into a hinge that loads the next deck station.
   * @param {BridgeDeckFragment} next
   * @param {number} direction Station travel direction, -1 or 1.
   * @returns {boolean}
   */
  connectTo(next, direction) {
    this.releaseSupport();
    if (next === this || next.#destroyed) {
      return false;
    }
    const attached = this.#attachPair(next, direction);
    if (attached) {
      this.#connectedTo = next;
      next.#supporters.add(this);
    }

    return attached;
  }

  /**
   * @param {BridgeDeckFragment|null} next
   * @param {number} direction
   * @returns {boolean}
   */
  #attachPair(next, direction) {
    const ammo = globalThis.Ammo;
    const world = this.#app.systems?.rigidbody?.dynamicsWorld;
    const body = this.entity.rigidbody?.body;
    const nextBody = next?.entity.rigidbody?.body;
    if (this.#destroyed || !ammo?.btPoint2PointConstraint || !world || !body || (next && !nextBody)) {
      return false;
    }
    this.#addConstraint(ammo, world, body, nextBody, direction, -0.85);
    this.#addConstraint(ammo, world, body, nextBody, direction, 0.85);
    body.activate();
    nextBody?.activate();

    return true;
  }

  /**
   * @param {typeof globalThis.Ammo} ammo
   * @param {import("sync-ammo/dist/ammo").btDiscreteDynamicsWorld} world
   * @param {import("sync-ammo/dist/ammo").btRigidBody} body
   * @param {import("sync-ammo/dist/ammo").btRigidBody|undefined} nextBody
   * @param {number} direction
   * @param {number} across
   */
  #addConstraint(ammo, world, body, nextBody, direction, across) {
    const local = this.#edgePoint(direction, across);
    const pivot = new ammo.btVector3(local.x, local.y, local.z);
    let constraint;
    if (nextBody) {
      const other = this.#edgePoint(-direction, across);
      const nextPivot = new ammo.btVector3(other.x, other.y, other.z);
      constraint = new ammo.btPoint2PointConstraint(body, nextBody, pivot, nextPivot);
      ammo.destroy(nextPivot);
    } else {
      constraint = new ammo.btPoint2PointConstraint(body, pivot);
      const position = this.entity.getWorldTransform().transformPoint(local);
      const anchor = new ammo.btVector3(position.x, position.y, position.z);
      constraint.setPivotB(anchor);
      ammo.destroy(anchor);
    }
    ammo.destroy(pivot);
    world.addConstraint(constraint, true);
    this.#constraints.push({
      ammo,
      world,
      constraint,
    });
  }

  /**
   * @param {number} direction
   * @param {number} across
   * @returns {import("playcanvas").Vec3}
   */
  #edgePoint(direction, across = 0) {
    return new this.#pc.Vec3(this.#horizontal ? direction * 0.5 : across,
      -0.12, this.#horizontal ? across : direction * 0.5);
  }

  /**
   * Positive metres fallen by the unsupported edge, measured from engine state.
   * @param {number} direction
   * @returns {number}
   */
  freeEdgeDrop(direction) {
    const edge = this.entity.getWorldTransform().transformPoint(this.#edgePoint(-direction));

    return Math.max(0, this.#initialHeight - 0.12 - edge.y);
  }

  /**
   * Relative deck angle in radians; no Euler feedback enters the simulation.
   * @param {BridgeDeckFragment} next
   * @returns {number}
   */
  supportAngleTo(next) {
    return Math.acos(Math.max(-1, Math.min(1, this.entity.up.dot(next.entity.up))));
  }

  releaseSupport() {
    for (const { ammo, world, constraint } of this.#constraints) {
      world.removeConstraint(constraint);
      ammo.destroy(constraint);
    }
    this.#constraints = [];
    this.#connectedTo?.#supporters.delete(this);
    this.#connectedTo = null;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#contactHandle?.off();
    this.#velocityHandle?.off();
    this.#pendingImpact = null;
    for (const supporter of [...this.#supporters]) {
      supporter.releaseSupport();
    }
    this.releaseSupport();
    this.#releaseFadeMaterials();
    this.#deck.destroy();
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.#buffers = [];
    this.entity.destroy();
  }
}
