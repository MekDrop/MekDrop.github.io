import { MUSHROOM_BRUTE_ANIMATION } from "./MushroomBruteAnimation.js";
import { BruteWindupState } from "./states/BruteWindupState.js";

/**
 * Samples the real, rendered skeleton; clip names alone cannot pass this check.
 */
export class MushroomBrutePlaybackCheck {
  /**
   * @param {import("./MushroomBrute.js").MushroomBrute} owner
   * @returns {Promise<{passed:boolean,clips:RuntimeClipCheck[]}>}
   */
  static async run(owner) {
    const clips = [];
    const previousScale = owner.app.timeScale;
    const joints = ["Stem", "Cap", "UpperArm.L", "Forearm.L", "UpperArm.R", "Thigh.L", "Shin.L", "Foot.L", "Club"]
      .map(/**
       *
       * @param {string} name
       */
        (name) => owner.modelRoot.findByName(name));
    const animation = owner.animationComponent;
    const others = owner.actors.filter(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor !== owner && actor.enemyType === owner.enemyType);
    for (const actor of others) {
      actor.testPlayClip("idle");
    }
    try {
      for (const name of Object.values(MUSHROOM_BRUTE_ANIMATION)) {
        owner.app.timeScale = 1;
        owner.testPlayClip(name);
        await MushroomBrutePlaybackCheck.#frame(owner);
        const duration = animation.baseLayer.activeStateDuration;
        const samples = [];
        let steps = 0;
        for (const fraction of [0.05, 0.35, 0.65, 0.9]) {
          // Rendered engine time, rather than wall-clock sleeps, handles slow frames.
          while (animation.baseLayer.activeStateCurrentTime < duration * fraction && steps++ < Math.ceil(duration * 120 + 60)) {
            await MushroomBrutePlaybackCheck.#frame(owner);
          }
          owner.app.render();
          samples.push({
            time: animation.baseLayer.activeStateCurrentTime,
            progress: animation.baseLayer.activeStateProgress,
            speed: animation.speed,
            joints: joints.map(MushroomBrutePlaybackCheck.#joint),
          });
        }
        const changed = joints.filter(/**
         *
         * @param {import("playcanvas").Entity} joint
         * @param {number} index
         */
          (joint, index) => samples.some(/**
         *
         * @param {RuntimeClipCheck["samples"][number]} sample
         */
            (sample) =>
              sample.joints[index].local.some(/**
           *
           * @param {number} value
           * @param {number} channel
           */
                (value, channel) => Math.abs(value - samples[0].joints[index].local[channel]) > 0.00001)));
        const finite = samples.every(MushroomBrutePlaybackCheck.#finite);
        clips.push({
          name,
          duration,
          changedNonRootJoints: changed.map(MushroomBrutePlaybackCheck.#name),
          passed: finite && changed.length >= 2,
          samples,
        });
      }
      // Exercise engine time scaling with a real looping clip and sample progress.
      owner.testPlayClip("idle");
      const timeScales = [];
      for (const scale of [0.5, 1, 2]) {
        owner.app.timeScale = scale;
        const start = animation.baseLayer.activeStateCurrentTime;
        for (let frame = 0; frame < 8; frame++) {
          await MushroomBrutePlaybackCheck.#frame(owner);
        }
        timeScales.push({
          scale,
          delta: animation.baseLayer.activeStateCurrentTime - start,
        });
        owner.app.render();
      }
      owner.app.timeScale = 1;
      const transitions = [];
      for (const name of ["heavy_walk", "run", "idle"]) {
        owner.playClip(name);
        for (let frame = 0; frame < 12; frame++) {
          await MushroomBrutePlaybackCheck.#frame(owner);
        }
        owner.app.render();
        transitions.push({
          name,
          complete: !animation.baseLayer.transitioning,
          time: animation.baseLayer.activeStateCurrentTime,
        });
      }
      const interactions = await MushroomBrutePlaybackCheck.#interactions(owner, others[0]);
      const report = {
        clock: "controlled_engine_fixed_step",
        stepSeconds: 1 / 60,
        note: "The HUD check calls app.update(step * app.timeScale) and renders every sampled pose. This does not measure background RAF pacing.",
        passed: clips.every(MushroomBrutePlaybackCheck.#passed) && timeScales.every(MushroomBrutePlaybackCheck.#advanced) && transitions.every(MushroomBrutePlaybackCheck.#complete) && interactions.passed,
        clips,
        timeScales,
        transitions,
        interactions,
        bounds: owner.modelRoot.findComponents("render").flatMap(MushroomBrutePlaybackCheck.#bounds),
      };
      console.info("MUSHROOM_BRUTE_PLAYBACK", JSON.stringify(report));
      const link = document.createElement("a");
      link.download = "mushroom-brute-playback-check.json";
      link.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
      link.click();

      return report;
    } finally {
      owner.app.timeScale = previousScale;
      owner.testPlayClip("idle");
    }
  }

  /**
   * @param {import("./MushroomBrute.js").MushroomBrute} owner
   * @returns {Promise<void>}
   */
  static async #frame(owner) {
    owner.app.update((1 / 60) * owner.app.timeScale);
  }

  /**
   * @param {import("./MushroomBrute.js").MushroomBrute} owner
   * @param {import("./MushroomBrute.js").MushroomBrute} ally
   */
  static async #interactions(owner, ally) {
    if (!ally?.alive) {
      return { passed: false };
    }
    const start = owner.position.clone();
    ally.entity.rigidbody.teleport(start.x, start.y, start.z + 1.1);
    ally.testPlayClip("idle");
    const health = ally.health;
    owner.attackTarget = ally;
    owner.behavior.changeTo(BruteWindupState.name);
    for (let frame = 0; frame < 96; frame++) {
      await MushroomBrutePlaybackCheck.#frame(owner);
    }
    owner.app.render();
    const friendlyDamage = health - ally.health;
    owner.testPlayClip("idle");
    const carrier = owner.actors.find(MushroomBrutePlaybackCheck.#hero);
    const pickupRejected = owner.beginCarry(carrier) === false && owner.enraged && owner.carrier === null;
    const throwRejected = owner.launch({
      velocity: {
        x: 0,
        y: 6,
        z: 1,
      },
      thrower: carrier,
    }) === false && !owner.airborne;
    owner.applyStatus("stun", { duration: 0.2 });
    const enteredStun = owner.stateName === "BruteStunState";
    owner.beginCarry(carrier);
    const pickupPreservedStun = owner.stateName === "BruteStunState";
    for (let frame = 0; frame < 16; frame++) {
      await MushroomBrutePlaybackCheck.#frame(owner);
    }
    const enteredRecover = owner.stateName === "BruteStunRecoverState";
    for (let frame = 0; frame < 44; frame++) {
      await MushroomBrutePlaybackCheck.#frame(owner);
    }
    const recovered = owner.stateName === "BrutePursueState";
    owner.testPlayClip("idle");
    ally.receiveDamage(999, owner);
    const enteredDeath = ally.stateName === "BruteDeathState";
    for (let frame = 0; frame < 110; frame++) {
      await MushroomBrutePlaybackCheck.#frame(owner);
    }
    const deathRemovedBody = !ally.entity.parent && !ally.entity.rigidbody;
    owner.app.render();

    return {
      passed: friendlyDamage > 0 && pickupRejected && throwRejected && enteredStun && pickupPreservedStun && enteredRecover && recovered && enteredDeath && deathRemovedBody,
      friendlyDamage,
      pickupRejected,
      throwRejected,
      enteredStun,
      pickupPreservedStun,
      enteredRecover,
      recovered,
      enteredDeath,
      deathRemovedBody,
    };
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  static #hero(actor) {
    return actor.constructor.name === "Hero";
  }

  /**
   * @param {{complete:boolean}} transition
   */
  static #complete(transition) {
    return transition.complete;
  }

  /**
   * @param {import("playcanvas").Entity} joint
   */
  static #joint(joint) {
    const p = joint.getLocalPosition();
    const q = joint.getLocalRotation();

    return {
      name: joint.name,
      local: [p.x, p.y, p.z, q.x, q.y, q.z, q.w],
    };
  }

  /**
   * @param {import("playcanvas").Entity} joint
   */
  static #name(joint) {
    return joint.name;
  }

  /**
   * @param {{time:number,progress:number,speed:number,joints:Array<{local:number[]}>}} sample
   */
  static #finite(sample) {
    return [sample.time, sample.progress, sample.speed, ...sample.joints.flatMap(MushroomBrutePlaybackCheck.#values)].every(Number.isFinite);
  }

  /**
   * @param {{local:number[]}} joint
   */
  static #values(joint) {
    return joint.local;
  }

  /**
   * @param {{passed:boolean}} clip
   */
  static #passed(clip) {
    return clip.passed;
  }

  /**
   * @param {{delta:number}} result
   */
  static #advanced(result) {
    return Number.isFinite(result.delta) && result.delta > 0;
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   */
  static #bounds(render) {
    return render.meshInstances.map(MushroomBrutePlaybackCheck.#meshBounds);
  }

  /**
   * @param {import("playcanvas").MeshInstance} mesh
   */
  static #meshBounds(mesh) {
    return {
      center: [mesh.aabb.center.x, mesh.aabb.center.y, mesh.aabb.center.z],
      halfExtents: [mesh.aabb.halfExtents.x, mesh.aabb.halfExtents.y, mesh.aabb.halfExtents.z],
      visible: mesh.visibleThisFrame,
    };
  }
}

/**
 * @typedef {{name:string,duration:number,changedNonRootJoints:string[],passed:boolean,samples:Array<{time:number,progress:number,speed:number,joints:Array<{name:string,local:number[]}>}>}} RuntimeClipCheck
 */
