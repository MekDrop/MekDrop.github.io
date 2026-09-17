import servantUrl from "../../models/castle/leisure/servant.glb?url";
import elderServantUrl from "../../models/castle/leisure/elder-servant.glb?url";
import tableUrl from "../../models/castle/leisure/tea-table.glb?url";
import chairUrl from "../../models/castle/leisure/tea-chair.glb?url";
import potUrl from "../../models/castle/leisure/teapot.glb?url";
import cupUrl from "../../models/castle/leisure/teacup.glb?url";
import sunbedUrl from "../../models/castle/leisure/sunbed.glb?url";
import bookUrl from "../../models/castle/leisure/open-book.glb?url";
import trayUrl from "../../models/castle/leisure/serving-tray.glb?url";
import { SeatedRoyal } from "./SeatedRoyal.js";
import { TerraceActor } from "./TerraceActor.js";
import { TerraceDoor } from "./TerraceDoor.js";
import { CastleLeisureSequence } from "./CastleLeisureSequence.js";
import { CASTLE_LEISURE_PHASE as PHASE } from "../../enum/CastleLeisurePhase.js";

const PROP_URLS = { table: tableUrl, chair: chairUrl, pot: potUrl,
  cup: cupUrl, sunbed: sunbedUrl, book: bookUrl };
const FURNITURE_POSITIONS = {
  table: [0.65, 0, 3.1], chair: [-0.75, 0, 3.2],
  pot: [0.92, 1.2, 3.0], cup: [0.25, 1.2, 3.25],
  sunbed: [0, 0, 3.1], book: [0, 1.1, 3.3],
};
const TRAY_POSITION = [0.61, 1.08, 3.08];
const CARRY_OFFSETS = {
  chair: [0, 0.55, 0.75],
  sunbed: [0, 0.55, 1.55],
};
const TABLE_GRIP_POINTS = [
  [-0.415, 1.069, -0.468],
  [0.415, 1.069, -0.468],
];
const TABLE_GRIP_MIDPOINT = [0, 1.069, -0.468];
const QUEEN_APPROACH_POSITION = [0.62, 0, 3.3];
const QUEEN_REST_POSITION = [0, 0, 3.1];
const QUEEN_ROUTE = [
  { progress: 0, x: 0, z: -1.4 },
  { progress: 0.55, x: 0, z: 1.2 },
  { progress: 0.68, x: 0.9, z: 1.65 },
  { progress: 0.92, x: 0.9, z: 3.3 },
  { progress: 1, x: QUEEN_APPROACH_POSITION[0], z: QUEEN_APPROACH_POSITION[2] },
];
const DOORWAY_POSITION_Z = -0.25;
const DOORWAY_START_Z = -1.4;
const DOORWAY_VISIBLE_Z = 0.2;
const DOORWAY_CLEAR_Z = 1.1;

/** A small, door-scaled performance on the audience chamber roof. */
export class CastleLeisureScene {
  static get modelUrls() {
    return [servantUrl, elderServantUrl, trayUrl,
      ...TerraceDoor.modelUrls, ...Object.values(PROP_URLS)];
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
  #tray;
  #bookOpenAmount = 0;
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
    this.#door.entity.setLocalPosition(0, 0, DOORWAY_POSITION_Z);
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
      this.#tray = modelLibrary.instantiate(trayUrl);
      this.#tray.name = "Terrace serving tray";
      this.#stage.addChild(this.#tray);
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

  get state() {
    const carryingTable = this.#sequence.cargo === "table" &&
      [PHASE.SERVANT_ENTER, PHASE.SERVANT_LEAVE].includes(this.#sequence.phase);
    const potHandDistance = this.#sequence.phase === PHASE.POUR && this.#servant
      ? this.#props.pot.getPosition().distance(this.#servant.rightHand.getPosition())
      : null;
    const sipping = this.#kind === "princess" && [PHASE.SETTLE, PHASE.LEISURE,
      PHASE.RISE].includes(this.#sequence.phase);
    const mouth = sipping ? this.#royal.head.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, -0.084, 0.538)) : null;
    const cupRim = sipping ? this.#props.cup.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, 0.212, 0)) : null;
    const mouthForward = sipping ? this.#royal.head.getWorldTransform()
      .transformVector(new this.#pc.Vec3(0, 0, 1)).normalize() : null;
    const cupFromMouth = sipping ? cupRim.clone().sub(mouth) : null;
    const royalPosition = this.#royal.entity.enabled
      ? this.#royal.entity.getLocalPosition() : null;
    return {
      kind: this.#kind,
      phase: this.#sequence.phase,
      progress: this.#sequence.progress,
      active: this.active,
      present: this.#present,
      royalPosition: royalPosition ? {
        x: royalPosition.x,
        y: royalPosition.y,
        z: royalPosition.z,
      } : null,
      royalYaw: this.#royal.entity.enabled
        ? this.#royal.entity.getLocalEulerAngles().y : null,
      trayVisible: this.#tray?.enabled ?? false,
      tableGripDistance: carryingTable ? this.#tableGripDistance() : null,
      bookOpenAmount: this.#kind === "queen" ? this.#bookOpenAmount : null,
      potHandDistance,
      cupLipDistance: cupFromMouth?.length() ?? null,
      cupLipClearance: cupFromMouth?.dot(mouthForward) ?? null,
      saucerVisible: this.#props.cup?.findByName("Ivory saucer")?.enabled ?? false,
    };
  }

  setVisitorPresent(value) {
    this.#present = Boolean(value);
    this.#sequence.present = this.#present;
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
    this.setVisitorPresent((inside || nearDoor) &&
      Math.abs((y ?? p.elevation) - p.elevation) < 2);
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
      if (phase === PHASE.LEISURE) {
        this.#activityTime = time;
      } else if (phase === PHASE.SETTLE) {
        this.#activityTime = 0;
      }
      if (this.#kind === "queen") {
        if (phase === PHASE.ROYAL_ENTER || phase === PHASE.ROYAL_EXIT) {
          this.#walkQueen(phase === PHASE.ROYAL_EXIT);
        } else if (phase === PHASE.SETTLE || phase === PHASE.RISE) {
          const mountProgress = phase === PHASE.SETTLE
            ? sequence.progress : 1 - sequence.progress;
          this.#poseQueenOnSunbed(mountProgress);
        } else {
          this.#royal.entity.setLocalPosition(...QUEEN_REST_POSITION);
          this.#royal.entity.setLocalEulerAngles(0, 0, 0);
          this.#royal.pose("read", this.#activityTime);
        }
      } else {
        const target = this.#kind === "princess" ? [-0.75, 0, 3.2] : [0, 0, 3.1];
        if (phase === PHASE.ROYAL_ENTER || phase === PHASE.ROYAL_EXIT) {
          this.#walk(this.#royal, target, phase === PHASE.ROYAL_EXIT);
          return this.#syncServant(sequence, phase, time);
        }
        this.#royal.entity.setLocalPosition(...target);
        this.#royal.entity.setLocalEulerAngles(0, this.#kind === "princess" ? 90 : 0, 0);
        const action = this.#kind === "king" ? "sword" : "drink";
        const blend = phase === PHASE.SETTLE ? sequence.progress
          : phase === PHASE.RISE ? 1 - sequence.progress : 1;
        this.#royal.pose(action, this.#activityTime, blend);
      }
    }
    this.#syncServant(sequence, phase, time);
  }

  #syncServant(sequence, phase, time) {
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
    const z = DOORWAY_START_Z + (target[2] - DOORWAY_START_Z) * progress;
    // Keep actors and carried furniture centered until they have completely
    // passed the outward-swinging leaf, then turn across the terrace.
    const lateralProgress = Math.max(0, Math.min(1,
      (z - DOORWAY_CLEAR_Z) / (target[2] - DOORWAY_CLEAR_Z)));
    const lateral = this.#ease(lateralProgress);
    const stairProgress = this.#ease(Math.max(0, Math.min(1,
      (z - DOORWAY_START_Z) / 1.5)));
    const y = -1.05 * (1 - stairProgress);
    actor.entity.setLocalPosition(target[0] * lateral, y, z);
    const yaw = Math.atan2(lateral > 0 && lateral < 1 ? target[0] : 0,
      target[2] - DOORWAY_CLEAR_Z) * 180 / Math.PI;
    actor.entity.setLocalEulerAngles(0, yaw + (leaving ? 180 : 0), 0);
    actor.entity.enabled = z > DOORWAY_VISIBLE_Z;
    const moving = t > 0 && t < 1;
    actor.pose(moving || action === "carry" ? action : "idle",
      travelTime * this.#sequence.walkSpeed);
  }

  #walkQueen(leaving) {
    const travelDuration = this.#sequence.duration - 0.7;
    const travelTime = Math.max(0,
      Math.min(travelDuration, this.#sequence.elapsed - 0.4));
    const t = travelTime / travelDuration;
    const progress = leaving ? 1 - t : t;
    const position = this.#queenRoutePoint(progress);
    const before = this.#queenRoutePoint(Math.max(0, progress - 0.002));
    const after = this.#queenRoutePoint(Math.min(1, progress + 0.002));
    const stairProgress = this.#ease(Math.max(0, Math.min(1,
      (position.z - DOORWAY_START_Z) / 1.5)));
    const y = -1.05 * (1 - stairProgress);
    this.#royal.entity.setLocalPosition(position.x, y, position.z);
    const direction = leaving ? -1 : 1;
    const yaw = Math.atan2((after.x - before.x) * direction,
      (after.z - before.z) * direction) * 180 / Math.PI;
    this.#royal.entity.setLocalEulerAngles(0, yaw, 0);
    this.#royal.entity.enabled = position.z > DOORWAY_VISIBLE_Z;
    const moving = t > 0 && t < 1;
    this.#royal.pose(moving ? "walk" : "idle",
      travelTime * this.#sequence.walkSpeed);
  }

  #queenRoutePoint(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    for (let index = 1; index < QUEEN_ROUTE.length; index += 1) {
      const start = QUEEN_ROUTE[index - 1];
      const end = QUEEN_ROUTE[index];
      if (clamped > end.progress) {
        continue;
      }
      const segment = this.#ease(
        (clamped - start.progress) / (end.progress - start.progress));
      return {
        x: start.x + (end.x - start.x) * segment,
        z: start.z + (end.z - start.z) * segment,
      };
    }
    return {
      x: QUEEN_APPROACH_POSITION[0],
      z: QUEEN_APPROACH_POSITION[2],
    };
  }

  #poseQueenOnSunbed(progress) {
    const phase = Math.max(0, Math.min(1, progress));
    const sitting = this.#ease(phase / 0.28);
    const feetUp = this.#ease(Math.max(0, Math.min(1,
      (phase - 0.28) / 0.34)));
    const x = QUEEN_APPROACH_POSITION[0] +
      (QUEEN_REST_POSITION[0] - QUEEN_APPROACH_POSITION[0]) * feetUp;
    const y = 0.18 * sitting * (1 - feetUp);
    const z = QUEEN_APPROACH_POSITION[2] +
      (QUEEN_REST_POSITION[2] - QUEEN_APPROACH_POSITION[2]) * feetUp;
    this.#royal.entity.setLocalPosition(x, y, z);
    this.#royal.entity.setLocalEulerAngles(0, -90 * (1 - feetUp), 0);
    this.#royal.pose("mountSunbed", phase);
  }

  #syncProps(cargo, carryingIn, carryingOut) {
    const sequence = this.#sequence;
    const phase = sequence.phase;
    const placing = phase === PHASE.FURNISH;
    const packing = phase === PHASE.PACK;
    this.#syncTray(cargo);
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
      prop.setLocalScale(1, name === "chair" ? 0.75 : 1, 1);
      if (moving) {
        if (itemCargo === "tea" && this.#tray?.enabled) {
          const trayPosition = this.#trayItemPosition(name);
          if (packing) {
            const load = this.#ease(Math.min(1, sequence.progress / 0.6));
            const floor = FURNITURE_POSITIONS[name];
            prop.setLocalPosition(
              floor[0] + (trayPosition.x - floor[0]) * load,
              floor[1] + (trayPosition.y - floor[1]) * load,
              floor[2] + (trayPosition.z - floor[2]) * load,
            );
          } else {
            prop.setLocalPosition(trayPosition);
          }
          prop.setLocalRotation(this.#tray.getLocalRotation());
          prop.enabled = this.#servant.entity.enabled;
          continue;
        }
        const carry = this.#carryPosition(name);
        const floor = FURNITURE_POSITIONS[name];
        const t = placing ? this.#ease(sequence.progress)
          : packing ? 1 - this.#ease(sequence.progress) : 0;
        prop.setLocalPosition(carry.x + (floor[0] - carry.x) * t,
          carry.y + (floor[1] - carry.y) * t,
          carry.z + (floor[2] - carry.z) * t);
        const carriedRotation = this.#servant.entity.getLocalRotation();
        const floorRotation = new this.#pc.Quat().setFromEulerAngles(
          0, name === "chair" ? 90 : 0, 0);
        prop.setLocalRotation(new this.#pc.Quat().slerp(
          carriedRotation,
          floorRotation,
          t,
        ));
        prop.enabled = this.#servant.entity.enabled;
      }
    }
    if (this.#teaStream) {
      this.#teaStream.enabled = false;
    }
    if (phase === PHASE.POUR) {
      const t = this.#ease(Math.min(1, sequence.progress * 4,
        (1 - sequence.progress) * 4));
      const hand = this.#stage.getWorldTransform().clone().invert()
        .transformPoint(this.#servant.rightHand.getPosition());
      const resting = FURNITURE_POSITIONS.pot;
      const grip = new this.#pc.Vec3(hand.x - 0.24, hand.y - 0.2, hand.z);
      this.#props.pot.setLocalPosition(
        resting[0] + (grip.x - resting[0]) * t,
        resting[1] + (grip.y - resting[1]) * t,
        resting[2] + (grip.z - resting[2]) * t,
      );
      this.#props.pot.setLocalEulerAngles(0, 180 * t, -35 * t);
      if (t > 0.95) {
        const spout = this.#props.pot.getWorldTransform().transformPoint(
          new this.#pc.Vec3(0.39, 0.375, 0));
        const from = this.#stage.getWorldTransform().clone().invert().transformPoint(spout);
        const to = new this.#pc.Vec3(0.25, 1.35, 3.25);
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
      this.#setCupSaucerVisible(false);
      this.#handProp(this.#props.cup, this.#royal.rightHand, null, mix,
        new this.#pc.Vec3(-0.14, 0, 0.25));
      this.#props.cup.setLocalEulerAngles(0, 90, 0);
    } else if (this.#kind === "princess") {
      this.#setCupSaucerVisible(true);
    }
    if (this.#kind === "queen") {
      this.#syncQueenBook(phase);
    }
  }

  #carryPosition(name) {
    if (name === "table") {
      const left = this.#servant.leftHand.getPosition();
      const handMidpoint = left.clone().lerp(
        left,
        this.#servant.rightHand.getPosition(),
        0.5,
      );
      const gripOffset = this.#servant.entity.getWorldTransform()
        .transformVector(new this.#pc.Vec3(...TABLE_GRIP_MIDPOINT));
      const tableOrigin = handMidpoint.sub(gripOffset);
      return this.#stage.getWorldTransform().clone().invert()
        .transformPoint(tableOrigin);
    }
    const offset = CARRY_OFFSETS[name] ?? [
      name === "pot" ? 0.15 : name === "cup" ? -0.18 : 0,
      name === "pot" || name === "cup" ? 1.05 : 0.55,
      0.75,
    ];
    // Carry furniture beyond its rear edge instead of centering it on the
    // servant. This leaves room for the torso while the hands hold that edge.
    const world = this.#servant.entity.getWorldTransform().transformPoint(
      new this.#pc.Vec3(...offset));
    return this.#stage.getWorldTransform().clone().invert().transformPoint(world);
  }

  #tableGripDistance() {
    const table = this.#props.table;
    if (!table || !this.#servant) {
      return null;
    }
    const hands = [this.#servant.leftHand, this.#servant.rightHand];
    const grips = TABLE_GRIP_POINTS.map((point) => table.getWorldTransform()
      .transformPoint(new this.#pc.Vec3(...point)));
    const direct = grips[0].distance(hands[0].getPosition()) +
      grips[1].distance(hands[1].getPosition());
    const crossed = grips[0].distance(hands[1].getPosition()) +
      grips[1].distance(hands[0].getPosition());
    // A 180-degree turn swaps screen-left and screen-right. The round tabletop
    // has equivalent grip points, so measure whichever hand pairing is nearer.
    return Math.min(direct, crossed) / TABLE_GRIP_POINTS.length;
  }

  #syncQueenBook(phase) {
    const book = this.#props.book;
    const visible = [PHASE.ROYAL_ENTER, PHASE.SETTLE, PHASE.LEISURE,
      PHASE.RISE, PHASE.ROYAL_EXIT].includes(phase) && this.#royal.entity.enabled;
    book.enabled = visible;
    if (!visible) {
      this.#bookOpenAmount = 0;
      this.#setBookOpen(0);
      return;
    }
    const mountProgress = phase === PHASE.SETTLE
      ? this.#sequence.progress
      : phase === PHASE.LEISURE ? 1
        : phase === PHASE.RISE ? 1 - this.#sequence.progress : 0;
    const raise = this.#ease(Math.max(0, Math.min(1,
      (mountProgress - 0.58) / 0.28)));
    this.#bookOpenAmount = this.#ease(Math.max(0, Math.min(1,
      (mountProgress - 0.78) / 0.22)));
    const left = this.#royal.leftHand.getPosition().clone();
    const reading = left.clone().lerp(
      left,
      this.#royal.rightHand.getPosition(),
      0.5,
    );
    reading.add(this.#royal.entity.getWorldTransform().transformVector(
      new this.#pc.Vec3(0, 0.12, 0.08)));
    const world = left.clone().lerp(left, reading, raise);
    const local = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(world);
    book.setLocalPosition(local.x, local.y + 0.035, local.z);
    book.setLocalEulerAngles(-25 * raise, 0, 0);
    this.#setBookOpen(this.#bookOpenAmount);
  }

  #setBookOpen(amount) {
    const angle = 84 - 72 * amount;
    this.#props.book.findByName("Book left cover")
      .setLocalEulerAngles(0, 0, -angle);
    this.#props.book.findByName("Book right cover")
      .setLocalEulerAngles(0, 0, angle);
  }

  #syncTray(cargo) {
    if (!this.#tray) {
      return;
    }
    const phase = this.#sequence.phase;
    const trayPhases = [PHASE.SERVANT_ENTER, PHASE.FURNISH, PHASE.POUR,
      PHASE.SERVANT_EXIT, PHASE.SERVANT_RETURN, PHASE.PACK,
      PHASE.SERVANT_LEAVE];
    this.#tray.enabled = cargo === "tea" && trayPhases.includes(phase) &&
      this.#servant.entity.enabled;
    if (!this.#tray.enabled) {
      return;
    }
    this.#tray.setLocalPosition(...TRAY_POSITION);
    this.#tray.setLocalEulerAngles(0, 0, 0);
    if (phase === PHASE.POUR) {
      return;
    }
    const held = this.#heldTrayPosition();
    let t = 0;
    if (phase === PHASE.FURNISH) {
      t = 1 - this.#ease(this.#sequence.progress);
    } else if (phase === PHASE.SERVANT_EXIT) {
      t = this.#ease(Math.min(1, this.#sequence.elapsed / 0.35));
    } else if (phase === PHASE.PACK) {
      t = this.#ease(Math.max(0, (this.#sequence.progress - 0.6) / 0.4));
    } else if (phase === PHASE.SERVANT_ENTER ||
      phase === PHASE.SERVANT_RETURN || phase === PHASE.SERVANT_LEAVE) {
      t = 1;
    }
    this.#tray.setLocalPosition(
      TRAY_POSITION[0] + (held.x - TRAY_POSITION[0]) * t,
      TRAY_POSITION[1] + (held.y - TRAY_POSITION[1]) * t,
      TRAY_POSITION[2] + (held.z - TRAY_POSITION[2]) * t,
    );
    this.#tray.setLocalRotation(new this.#pc.Quat().slerp(
      new this.#pc.Quat(),
      this.#servant.entity.getLocalRotation(),
      t,
    ));
  }

  #heldTrayPosition() {
    const left = this.#servant.leftHand.getPosition();
    const world = left.clone().lerp(
      left,
      this.#servant.rightHand.getPosition(),
      0.5,
    );
    world.y -= 0.1;
    return this.#stage.getWorldTransform().clone().invert().transformPoint(world);
  }

  #trayItemPosition(name) {
    const offset = name === "pot"
      ? new this.#pc.Vec3(0.31, 0.12, -0.08)
      : new this.#pc.Vec3(-0.36, 0.12, 0.17);
    const world = this.#tray.getWorldTransform().transformPoint(offset);
    return this.#stage.getWorldTransform().clone().invert().transformPoint(world);
  }

  #setCupSaucerVisible(visible) {
    this.#props.cup.findByName("Ivory saucer").enabled = visible;
    this.#props.cup.findByName("Saucer gilt edge").enabled = visible;
  }

  #handProp(prop, hand, secondHand = null, mix = 1, actorOffset = null) {
    if (!hand) {
      return;
    }
    const world = hand.getPosition().clone();
    if (secondHand) {
      world.lerp(world, secondHand.getPosition(), 0.5);
    }
    if (actorOffset) {
      world.add(this.#royal.entity.getWorldTransform().transformVector(actorOffset));
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
