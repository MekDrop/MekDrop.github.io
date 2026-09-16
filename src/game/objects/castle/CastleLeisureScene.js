import servantUrl from "../../models/castle/leisure/servant.glb?url";
import elderServantUrl from "../../models/castle/leisure/elder-servant.glb?url";
import tableUrl from "../../models/castle/leisure/tea-table.glb?url";
import chairUrl from "../../models/castle/leisure/tea-chair.glb?url";
import potUrl from "../../models/castle/leisure/teapot.glb?url";
import cupUrl from "../../models/castle/leisure/teacup.glb?url";
import sunbedUrl from "../../models/castle/leisure/sunbed.glb?url";
import bookUrl from "../../models/castle/leisure/open-book.glb?url";
import { SeatedRoyal } from "./SeatedRoyal.js";
import { TerraceActor } from "./TerraceActor.js";
import { TerraceDoor } from "./TerraceDoor.js";
import { CastleLeisureSequence } from "./CastleLeisureSequence.js";
import { CASTLE_LEISURE_PHASE as PHASE } from "../../enum/CastleLeisurePhase.js";

const PROP_URLS = { table: tableUrl, chair: chairUrl, pot: potUrl,
  cup: cupUrl, sunbed: sunbedUrl, book: bookUrl };
const FURNITURE_POSITIONS = {
  table: [0.65, 0, 3.1], chair: [-0.75, 0, 3.2],
  pot: [0.92, 1.1, 3.0], cup: [0.25, 1.1, 3.25],
  sunbed: [0, 0, 3.1], book: [0, 1.1, 3.3],
};

/** A small, door-scaled performance on the audience chamber roof. */
export class CastleLeisureScene {
  static get modelUrls() {
    return [servantUrl, elderServantUrl, ...Object.values(PROP_URLS)];
  }

  #pc;
  #entity;
  #stage;
  #door;
  #royal;
  #servant;
  #servants = [];
  #servantVisit = -1;
  #props = {};
  #kind;
  #sequence;
  #position;
  #doors;
  #present = false;
  #stopped = false;
  #teaStream;
  #teaMaterial;
  #activityTime = 0;

  constructor({ pc, modelLibrary, seed, position, doors, layout }) {
    this.#pc = pc;
    this.#position = position;
    this.#doors = doors;
    const royalIndex = (Number(seed) >>> 0) % SeatedRoyal.modelUrls.length;
    this.#kind = ["king", "queen", "princess"][royalIndex];
    this.#sequence = new CastleLeisureSequence(this.#kind);
    this.#entity = new pc.Entity("Castle terrace leisure");
    this.#entity.setLocalPosition(layout.x, layout.y, layout.z);
    this.#entity.setLocalEulerAngles(0, layout.yaw, 0);
    this.#door = new TerraceDoor({ modelLibrary });
    this.#entity.addChild(this.#door.entity);
    this.#stage = new pc.Entity("Terrace performance");
    // Standing actors are 2.2 units tall; leave headroom in the 1.25-unit door.
    const scale = Math.min(0.45, layout.depth / 5.5, layout.width / 4.2);
    this.#stage.setLocalScale(scale, scale, scale);
    this.#entity.addChild(this.#stage);
    this.#royal = new TerraceActor({ pc, modelLibrary,
      modelUrl: SeatedRoyal.modelUrls[royalIndex], kind: this.#kind });
    this.#stage.addChild(this.#royal.entity);
    if (this.#kind !== "king") {
      for (const modelUrl of [servantUrl, elderServantUrl]) {
        const actor = new TerraceActor({ pc, modelLibrary, modelUrl, kind: "servant" });
        actor.entity.name = "Terrace servant standby";
        actor.entity.enabled = false;
        this.#stage.addChild(actor.entity);
        this.#servants.push(actor);
      }
      this.#servant = this.#servants[0];
      const names = this.#kind === "queen"
        ? ["sunbed", "book"] : ["table", "chair", "pot", "cup"];
      for (const name of names) {
        const prop = modelLibrary.instantiate(PROP_URLS[name]);
        prop.name = `Terrace ${name}`;
        this.#stage.addChild(prop);
        this.#props[name] = prop;
      }
    }
    if (this.#kind === "princess") {
      this.#teaMaterial = new pc.StandardMaterial();
      this.#teaMaterial.diffuse = new pc.Color(0.48, 0.22, 0.05);
      this.#teaMaterial.update();
      this.#teaStream = new pc.Entity("Pouring tea");
      this.#teaStream.addComponent("render", {
        type: "cylinder", castShadows: false, receiveShadows: false,
      });
      this.#teaStream.render.meshInstances[0].material = this.#teaMaterial;
      this.#stage.addChild(this.#teaStream);
    }
    this.#sync();
  }

  get entity() {
    return this.#entity;
  }

  get active() {
    return this.#sequence.active;
  }

  updateHeroPosition({ x, y, z }) {
    if (this.#stopped) {
      return;
    }
    const p = this.#position;
    const inside = x >= p.x && x <= p.x + p.width &&
      z >= p.z && z <= p.z + p.depth;
    const distance = this.#present ? 2.4 : 1.7;
    const nearDoor = this.#doors.some((door) => {
      const vertical = door.side === "WEST" || door.side === "EAST";
      const lateral = vertical ? z - p.z : x - p.x;
      const boundary = door.side === "WEST" ? p.x
        : door.side === "EAST" ? p.x + p.width
          : door.side === "NORTH" ? p.z : p.z + p.depth;
      return Math.abs((vertical ? x : z) - boundary) <= distance &&
        lateral >= door.offset - 0.55 &&
        lateral <= door.offset + door.width + 0.55;
    });
    this.#present = (inside || nearDoor) &&
      Math.abs((y ?? p.elevation) - p.elevation) < 2;
    this.#sequence.present = this.#present;
  }

  update(deltaTime) {
    if (this.#stopped) {
      return;
    }
    this.#sequence.update(deltaTime);
    this.#sync();
    const phase = this.#sequence.phase;
    this.#door.update(deltaTime, [PHASE.SERVANT_ENTER, PHASE.SERVANT_EXIT,
      PHASE.ROYAL_ENTER, PHASE.ROYAL_EXIT, PHASE.SERVANT_RETURN,
      PHASE.SERVANT_LEAVE].includes(phase));
  }

  stop() {
    this.#stopped = true;
    this.#sequence.reset();
    this.#sync();
    this.#door.update(1, false);
  }

  destroy() {
    this.#sequence.reset();
    this.#royal.destroy();
    for (const servant of this.#servants) {
      servant.destroy();
    }
    this.#door.destroy();
    this.#entity.destroy();
    this.#teaMaterial?.destroy();
  }

  #sync() {
    this.#stage.enabled = this.active;
    if (!this.active) {
      return;
    }
    const sequence = this.#sequence;
    if (this.#servants.length && this.#servantVisit !== sequence.visitId) {
      this.#servantVisit = sequence.visitId;
      for (const servant of this.#servants) {
        servant.entity.enabled = false;
        servant.entity.name = "Terrace servant standby";
      }
      this.#servant = this.#servants[Math.floor(Math.random() * this.#servants.length)];
      this.#servant.entity.name = "Terrace servant";
    }
    const phase = sequence.phase;
    const time = sequence.elapsed;
    const royalVisible = [PHASE.ROYAL_ENTER, PHASE.SETTLE, PHASE.LEISURE,
      PHASE.RISE, PHASE.ROYAL_EXIT].includes(phase);
    this.#royal.entity.enabled = royalVisible;
    if (royalVisible) {
      const target = this.#kind === "princess" ? [-0.75, 0, 3.2] : [0, 0, 3.1];
      if (phase === PHASE.ROYAL_ENTER || phase === PHASE.ROYAL_EXIT) {
        this.#walk(this.#royal, target, phase === PHASE.ROYAL_EXIT);
      } else {
        this.#royal.entity.setLocalPosition(...target);
        this.#royal.entity.setLocalEulerAngles(0, this.#kind === "princess" ? 90 : 0, 0);
        const action = this.#kind === "king" ? "sword"
          : this.#kind === "queen" ? "read" : "drink";
        const blend = phase === PHASE.SETTLE ? sequence.progress
          : phase === PHASE.RISE ? 1 - sequence.progress : 1;
        if (phase === PHASE.LEISURE) {
          this.#activityTime = time;
        } else if (phase === PHASE.SETTLE) {
          this.#activityTime = 0;
        }
        this.#royal.pose(action, this.#activityTime, blend);
      }
    }
    if (!this.#servant) {
      return;
    }
    const servantVisible = [PHASE.SERVANT_ENTER, PHASE.FURNISH, PHASE.POUR,
      PHASE.SERVANT_EXIT, PHASE.SERVANT_RETURN, PHASE.PACK,
      PHASE.SERVANT_LEAVE].includes(phase);
    this.#servant.entity.enabled = servantVisible;
    const cargo = sequence.cargo;
    const target = cargo === "chair" ? [-0.75, 0, 2.25]
      : cargo === "sunbed" ? [0, 0, 1.55] : [0.65, 0, 2.1];
    const carryingIn = phase === PHASE.SERVANT_ENTER;
    const carryingOut = phase === PHASE.SERVANT_LEAVE;
    if (servantVisible) {
      if ([PHASE.SERVANT_ENTER, PHASE.SERVANT_RETURN, PHASE.SERVANT_EXIT,
        PHASE.SERVANT_LEAVE].includes(phase)) {
        this.#walk(this.#servant, target,
          phase === PHASE.SERVANT_EXIT || carryingOut,
          carryingIn || carryingOut ? "carry" : "walk");
      } else {
        this.#servant.entity.setLocalPosition(...target);
        this.#servant.entity.setLocalEulerAngles(0, 0, 0);
        this.#servant.pose(phase === PHASE.POUR ? "pour" : "place",
          phase === PHASE.POUR ? time
            : 2 * (phase === PHASE.PACK ? 1 - sequence.progress : sequence.progress));
      }
    }
    this.#syncProps(cargo, carryingIn, carryingOut);
  }

  #walk(actor, target, leaving, action = "walk") {
    // Pause behind the wall while the doors swing clear, then use the center aisle.
    const travelDuration = this.#sequence.duration - 0.7;
    const travelTime = Math.max(0, Math.min(travelDuration, this.#sequence.elapsed - 0.4));
    const t = travelTime / travelDuration;
    const progress = leaving ? 1 - t : t;
    const z = -0.35 + (target[2] + 0.35) * progress;
    const lateral = Math.max(0, Math.min(1, (progress - 0.38) / 0.62));
    actor.entity.setLocalPosition(target[0] * lateral, 0, z);
    const yaw = Math.atan2(lateral > 0 && lateral < 1 ? target[0] : 0,
      target[2] + 0.35) * 180 / Math.PI;
    actor.entity.setLocalEulerAngles(0, yaw + (leaving ? 180 : 0), 0);
    actor.entity.enabled = z > -0.25;
    const moving = t > 0 && t < 1;
    actor.pose(moving || action === "carry" ? action : "idle",
      travelTime * this.#sequence.walkSpeed);
  }

  #syncProps(cargo, carryingIn, carryingOut) {
    const sequence = this.#sequence;
    const phase = sequence.phase;
    const placing = phase === PHASE.FURNISH;
    const packing = phase === PHASE.PACK;
    for (const [name, prop] of Object.entries(this.#props)) {
      const itemCargo = name === "cup" || name === "pot" ? "tea" : name;
      const index = ["table", "chair", "tea"].indexOf(itemCargo);
      const installed = this.#kind === "queen"
        ? sequence.installedCount > 0 : index < sequence.installedCount;
      const moving = itemCargo === cargo &&
        (carryingIn || carryingOut || placing || packing);
      prop.enabled = name !== "book" && (installed || moving);
      prop.setLocalPosition(...FURNITURE_POSITIONS[name]);
      prop.setLocalEulerAngles(0, name === "chair" ? 90 : 0, 0);
      if (moving) {
        const carry = this.#carryPosition(name);
        const floor = FURNITURE_POSITIONS[name];
        const t = placing ? this.#ease(sequence.progress)
          : packing ? 1 - this.#ease(sequence.progress) : 0;
        prop.setLocalPosition(carry.x + (floor[0] - carry.x) * t,
          carry.y + (floor[1] - carry.y) * t,
          carry.z + (floor[2] - carry.z) * t);
        prop.setLocalEulerAngles(0,
          (1 - t) * this.#servant.entity.getLocalEulerAngles().y +
          t * (name === "chair" ? 90 : 0), 0);
        prop.enabled = this.#servant.entity.enabled;
      }
    }
    if (this.#teaStream) {
      this.#teaStream.enabled = false;
    }
    if (phase === PHASE.POUR) {
      const t = this.#ease(Math.min(1, sequence.progress * 4,
        (1 - sequence.progress) * 4));
      this.#props.pot.setLocalPosition(0.92 - t * 0.12, 1.1 + t * 0.42,
        3 + t * 0.25);
      this.#props.pot.setLocalEulerAngles(0, 180 * t, -35 * t);
      if (t > 0.95) {
        const spout = this.#props.pot.getWorldTransform().transformPoint(
          new this.#pc.Vec3(0.39, 0.375, 0));
        const from = this.#stage.getWorldTransform().clone().invert().transformPoint(spout);
        const to = new this.#pc.Vec3(0.25, 1.25, 3.25);
        const direction = to.clone().sub(from);
        this.#teaStream.enabled = true;
        this.#teaStream.setLocalPosition(from.clone().add(to).mulScalar(0.5));
        this.#teaStream.setLocalScale(0.018, direction.length(), 0.018);
        this.#teaStream.setLocalRotation(new this.#pc.Quat().setFromDirections(
          this.#pc.Vec3.UP, direction.normalize()));
      }
    }
    const seated = [PHASE.SETTLE, PHASE.LEISURE, PHASE.RISE].includes(phase);
    if (this.#kind === "princess" && seated) {
      const mix = phase === PHASE.SETTLE ? this.#ease(sequence.progress)
        : phase === PHASE.RISE ? 1 - this.#ease(sequence.progress) : 1;
      this.#handProp(this.#props.cup, this.#royal.rightHand, null, mix);
    }
    if (this.#kind === "queen" && (seated || phase === PHASE.ROYAL_ENTER ||
      phase === PHASE.ROYAL_EXIT)) {
      this.#props.book.enabled = this.#royal.entity.enabled;
      this.#handProp(this.#props.book, this.#royal.rightHand, seated ? this.#royal.leftHand : null);
      this.#props.book.setLocalEulerAngles(-25, 0, 0);
    }
  }

  #carryPosition(name) {
    const offsetX = name === "pot" ? 0.15 : name === "cup" ? -0.18 : 0;
    const height = name === "sunbed" ? 0.55
      : name === "pot" || name === "cup" ? 1.05 : 0.55;
    const world = this.#servant.entity.getWorldTransform().transformPoint(
      new this.#pc.Vec3(offsetX, height, name === "sunbed" ? 0.9 : 0.75));
    return this.#stage.getWorldTransform().clone().invert().transformPoint(world);
  }

  #handProp(prop, hand, secondHand = null, mix = 1) {
    if (!hand) {
      return;
    }
    const world = hand.getPosition().clone();
    if (secondHand) {
      world.lerp(world, secondHand.getPosition(), 0.5);
    }
    const local = this.#stage.getWorldTransform().clone().invert().transformPoint(world);
    const start = prop.getLocalPosition();
    prop.setLocalPosition(start.x + (local.x - start.x) * mix,
      start.y + (local.y + 0.035 - start.y) * mix,
      start.z + (local.z - start.z) * mix);
  }

  #ease(value) {
    return value * value * (3 - 2 * value);
  }
}
