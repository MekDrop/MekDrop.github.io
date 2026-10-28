import { CastleAudio } from "../../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../../audio/GameObjectAudio.js";
import { HERO_ACTION } from "../../../enum/HeroAction.js";

/**
 * Player foley follows travelled distance and committed action contact frames.
 */
export class HeroAudio {
  /**
   * @type {GameObjectAudio}
   */
  #audio;
  /**
   * @type {{x:number,y:number,z:number}|null}
   */
  #previous = null;
  /**
   * @type {boolean}
   */
  #grounded = true;
  /**
   * @type {number}
   */
  #distance = 0;
  /**
   * @type {number}
   */
  #step = 0;
  /**
   * @type {number}
   */
  #impactCooldown = 0;
  /**
   * @type {number}
   */
  #airTime = 0;
  /**
   * @type {string|null}
   */
  #action = null;
  /**
   * @type {import("../../../GameContracts.js").GameMapData}
   */
  #map;

  /**
   * @returns {Record<string,{wavUrl:string,oggUrl:string}>}
   */
  static get clips() {
    return {
      grassStep1: CastleAudio.grassStep1,
      grassStep2: CastleAudio.grassStep2,
      stoneStep1: CastleAudio.stoneStep1,
      stoneStep2: CastleAudio.stoneStep2,
      jump: CastleAudio.swing,
      land: CastleAudio.land,
      axe: CastleAudio.chop,
      hammer: CastleAudio.hammer,
      shovel: CastleAudio.grassStep1,
      break: CastleAudio.woodBreak,
      summon: CastleAudio.swing,
      pickup: CastleAudio.pickup,
      cloth: CastleAudio.cloth,
      latch: CastleAudio.latch,
      respawn: CastleAudio.reveal,
      teleport: CastleAudio.mist,
    };
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Application} app
   * @param {import("../../../audio/GameAudioLibrary.js").GameAudioLibrary} library
   * @param {import("../../../GameContracts.js").GameMapData} map
   */
  constructor(entity, app, library, map) {
    this.#audio = new GameObjectAudio(entity, app, library, HeroAudio.clips, 0.28);
    this.#map = map;
  }

  /**
   * @param {string} name
   */
  play(name) {
    this.#audio.play(name, 0.96 + Math.random() * 0.08);
  }

  /**
   * Swept contacts can occur on consecutive frames; avoid a sound per voxel.
   * @param {string} tool
   */
  impact(tool) {
    if (this.#impactCooldown > 0) {
      return;
    }
    this.play(tool);
    this.#impactCooldown = 0.16;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,z:number}} position
   * @param {boolean} grounded
   * @param {boolean} climbing
   * @param {string|null} [action]
   */
  update(dt, position, grounded, climbing, action = null) {
    if (action !== this.#action) {
      const cue = {
        [HERO_ACTION.DODGING]: "cloth",
        [HERO_ACTION.PAT_REACTION]: "cloth",
        [HERO_ACTION.EDGE_REFUSAL]: "cloth",
        [HERO_ACTION.HOLE_REFUSAL]: "cloth",
        [HERO_ACTION.BLOCKED_DIG_REACTION]: "latch",
        [HERO_ACTION.INVENTORY_FULL_REACTION]: "latch",
        [HERO_ACTION.FALLING_TO_DEATH]: "cloth",
        [HERO_ACTION.GAME_OVER]: "land",
        [HERO_ACTION.RESPAWNING]: "respawn",
      }[action];
      if (cue) {
        this.play(cue);
      }
      this.#action = action;
    }
    this.#impactCooldown = Math.max(0, this.#impactCooldown - dt);
    if (!grounded && !climbing) {
      this.#airTime += dt;
    }
    if (this.#previous) {
      const distance = Math.hypot(position.x - this.#previous.x, position.z - this.#previous.z,
        climbing ? position.y - this.#previous.y : 0);
      const continuous = Math.hypot(position.x - this.#previous.x, position.y - this.#previous.y,
        position.z - this.#previous.z) < 1;
      if (continuous && grounded && !this.#grounded && !climbing && this.#airTime > 0.15) {
        this.play("land");
      }
      if (continuous && (grounded || climbing) && distance > 0.001) {
        this.#distance += distance;
        if (this.#distance >= (climbing ? 0.65 : 1.05)) {
          this.#distance = 0;
          this.#step = 1 - this.#step;
          const stone = this.#map.objects?.some(/**
           *
           * @param {import("../../ObjectTypes.js").MapObjectDefinition} object
           */
            (object) => {
              const footprint = object.object === "Castle" ? object.buildPlan?.input.position : null;

              return footprint && position.x >= footprint.x && position.x <= footprint.x + footprint.width &&
              position.z >= footprint.z && position.z <= footprint.z + footprint.depth;
            });
          this.play(`${stone || climbing ? "stone" : "grass"}Step${this.#step + 1}`);
        }
      } else {
        this.#distance = 0;
      }
    }
    this.#previous = { ...position };
    this.#grounded = grounded;
    if (grounded || climbing) {
      this.#airTime = 0;
    }
  }
}
