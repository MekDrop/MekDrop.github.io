import potUrl from "../../models/castle/leisure/teapot.glb?url";
import cupUrl from "../../models/castle/leisure/teacup.glb?url";
import trayUrl from "../../models/castle/leisure/serving-tray.glb?url";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";

const POSITIONS = {
  pot: [0.92, 1.2, 3.0],
  cup: [0.25, 1.2, 3.25],
};
const TRAY_POSITION = [0.61, 1.08, 3.08];
const ease = (value) => value * value * (3 - 2 * value);

/**
 * Executes tray, pouring, and drinking actions after tea is requested.
 */
export class TerraceTeaSetActions {
  static get modelUrls() {
    return [potUrl, cupUrl, trayUrl];
  }

  #pc;
  #stage;
  #royal;
  #pot;
  #cup;
  #tray;
  #stream;
  #material;
  #servant = null;
  #servantBehavior = null;
  #royalBehavior = null;

  constructor({ pc, modelLibrary, stage, royal }) {
    this.#pc = pc;
    this.#stage = stage;
    this.#royal = royal;
    this.#pot = modelLibrary.instantiate(potUrl);
    this.#pot.name = "Terrace pot";
    stage.addChild(this.#pot);
    this.#cup = modelLibrary.instantiate(cupUrl);
    this.#cup.name = "Terrace cup";
    stage.addChild(this.#cup);
    this.#tray = modelLibrary.instantiate(trayUrl);
    this.#tray.name = "Terrace serving tray";
    stage.addChild(this.#tray);
    this.#material = new pc.StandardMaterial();
    this.#material.diffuse = new pc.Color(0.48, 0.22, 0.05);
    this.#material.update();
    this.#stream = new pc.Entity("Pouring tea");
    this.#stream.addComponent("render", {
      type: "cylinder",
      castShadows: false,
      receiveShadows: false,
    });
    this.#stream.render.meshInstances[0].material = this.#material;
    stage.addChild(this.#stream);
  }

  get state() {
    const pouring = this.#servantBehavior?.stagePhase === PHASE.POUR;
    const potHandDistance = pouring && this.#servant
      ? this.#pot.getPosition().distance(this.#servant.rightHand.getPosition())
      : null;
    const sipping = [PHASE.SETTLE, PHASE.ACTIVITY, PHASE.RISE]
      .includes(this.#royalBehavior?.stagePhase);
    const mouth = sipping
      ? this.#royal.head.getWorldTransform().transformPoint(
        new this.#pc.Vec3(0, -0.084, 0.538),
      ) : null;
    const rim = sipping
      ? this.#cup.getWorldTransform().transformPoint(
        new this.#pc.Vec3(0, 0.212, 0),
      ) : null;
    const forward = sipping
      ? this.#royal.head.getWorldTransform()
        .transformVector(new this.#pc.Vec3(0, 0, 1)).normalize()
      : null;
    const cupFromMouth = sipping ? rim.clone().sub(mouth) : null;
    return {
      trayVisible: this.#tray.enabled,
      potHandDistance,
      cupLipDistance: cupFromMouth?.length() ?? null,
      cupLipClearance: cupFromMouth?.dot(forward) ?? null,
      saucerVisible:
        this.#cup.findByName("Ivory saucer")?.enabled ?? false,
    };
  }

  sync(servantBehavior, royalBehavior, servant) {
    this.#servantBehavior = servantBehavior;
    this.#royalBehavior = royalBehavior;
    this.#servant = servant;
    this.#syncTray();
    this.#syncSet();
    this.#syncPouring();
    this.#syncCup();
  }

  destroy() {
    this.#material.destroy();
    this.#material = null;
  }

  #syncSet() {
    const behavior = this.#servantBehavior;
    const phase = behavior.stagePhase;
    const moving = behavior.cargo === "tea" && [PHASE.SERVANT_ENTER,
      PHASE.FURNISH, PHASE.PACK, PHASE.SERVANT_LEAVE].includes(phase);
    const installed = behavior.installedCount > 2;
    for (const [name, prop] of [["pot", this.#pot], ["cup", this.#cup]]) {
      prop.enabled = installed || moving;
      prop.setLocalPosition(...POSITIONS[name]);
      prop.setLocalEulerAngles(0, 0, 0);
      prop.setLocalScale(1, 1, 1);
      if (moving && this.#tray.enabled) {
        this.#moveWithTray(name, prop, phase === PHASE.PACK);
      }
    }
  }

  #moveWithTray(name, prop, packing) {
    const trayPosition = this.#trayItemPosition(name);
    if (packing) {
      const load = ease(Math.min(1, this.#servantBehavior.progress / 0.6));
      const floor = POSITIONS[name];
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
  }

  #syncPouring() {
    this.#stream.enabled = false;
    const behavior = this.#servantBehavior;
    if (behavior.stagePhase !== PHASE.POUR) {
      return;
    }
    const progress = ease(Math.min(
      1,
      behavior.progress * 4,
      (1 - behavior.progress) * 4,
    ));
    const hand = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(this.#servant.rightHand.getPosition());
    const resting = POSITIONS.pot;
    const grip = new this.#pc.Vec3(hand.x - 0.24, hand.y - 0.2, hand.z);
    this.#pot.setLocalPosition(
      resting[0] + (grip.x - resting[0]) * progress,
      resting[1] + (grip.y - resting[1]) * progress,
      resting[2] + (grip.z - resting[2]) * progress,
    );
    this.#pot.setLocalEulerAngles(0, 180 * progress, -35 * progress);
    if (progress <= 0.95) {
      return;
    }
    const spout = this.#pot.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0.39, 0.375, 0),
    );
    const from = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(spout);
    const to = new this.#pc.Vec3(0.25, 1.35, 3.25);
    const direction = to.clone().sub(from);
    this.#stream.enabled = true;
    this.#stream.setLocalPosition(from.clone().add(to).mulScalar(0.5));
    this.#stream.setLocalScale(0.018, direction.length(), 0.018);
    this.#stream.setLocalRotation(new this.#pc.Quat().setFromDirections(
      this.#pc.Vec3.UP,
      direction.normalize(),
    ));
  }

  #syncTray() {
    const behavior = this.#servantBehavior;
    const phase = behavior.stagePhase;
    const phases = [PHASE.SERVANT_ENTER, PHASE.FURNISH, PHASE.POUR,
      PHASE.SERVANT_EXIT, PHASE.SERVANT_RETURN, PHASE.PACK,
      PHASE.SERVANT_LEAVE];
    this.#tray.enabled = behavior.cargo === "tea" && phases.includes(phase) &&
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
    let progress = 0;
    if (phase === PHASE.FURNISH) {
      progress = 1 - ease(behavior.progress);
    } else if (phase === PHASE.SERVANT_EXIT) {
      progress = ease(Math.min(1, behavior.elapsed / 0.35));
    } else if (phase === PHASE.PACK) {
      progress = ease(Math.max(0, (behavior.progress - 0.6) / 0.4));
    } else if ([PHASE.SERVANT_ENTER, PHASE.SERVANT_RETURN,
      PHASE.SERVANT_LEAVE].includes(phase)) {
      progress = 1;
    }
    this.#tray.setLocalPosition(
      TRAY_POSITION[0] + (held.x - TRAY_POSITION[0]) * progress,
      TRAY_POSITION[1] + (held.y - TRAY_POSITION[1]) * progress,
      TRAY_POSITION[2] + (held.z - TRAY_POSITION[2]) * progress,
    );
    this.#tray.setLocalRotation(new this.#pc.Quat().slerp(
      new this.#pc.Quat(),
      this.#servant.entity.getLocalRotation(),
      progress,
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

  #syncCup() {
    const phase = this.#royalBehavior.stagePhase;
    if (![PHASE.SETTLE, PHASE.ACTIVITY, PHASE.RISE].includes(phase)) {
      this.#setSaucerVisible(true);
      return;
    }
    const mix = phase === PHASE.SETTLE
      ? ease(this.#royalBehavior.progress)
      : phase === PHASE.RISE ? 1 - ease(this.#royalBehavior.progress) : 1;
    this.#setSaucerVisible(false);
    const world = this.#royal.rightHand.getPosition().clone();
    world.add(this.#royal.entity.getWorldTransform().transformVector(
      new this.#pc.Vec3(-0.14, 0, 0.25),
    ));
    const local = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(world);
    const start = this.#cup.getLocalPosition();
    this.#cup.setLocalPosition(
      start.x + (local.x - start.x) * mix,
      start.y + (local.y + 0.035 - start.y) * mix,
      start.z + (local.z - start.z) * mix,
    );
    this.#cup.setLocalEulerAngles(0, 90, 0);
  }

  #setSaucerVisible(visible) {
    this.#cup.findByName("Ivory saucer").enabled = visible;
    this.#cup.findByName("Saucer gilt edge").enabled = visible;
  }
}
