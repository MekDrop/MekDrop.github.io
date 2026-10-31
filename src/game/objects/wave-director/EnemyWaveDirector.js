import { WaveDirectorState } from "../../waves/WaveDirectorState.js";
import { WaveAiController } from "../../waves/WaveAiController.js";
import { PlayerWaveController } from "../../waves/PlayerWaveController.js";
import { WAVE_CONFIG } from "../../waves/wave-config.js";
import { WaveDirectorHud } from "../../ui/WaveDirectorHud.js";

/**
 * Map-owned host authority; a replaceable controller supplies only purchase commands.
 */
export class EnemyWaveDirector {
  /**
   * @type {WaveDirectorState}
   */
  #state;
  /**
   * @type {WaveAiController|PlayerWaveController}
   */
  #controller;
  /**
   * @type {Map<string,import("../enemies/shared/Enemy.js").Enemy>}
   */
  #units = new Map();
  /**
   * @type {WeakSet<import("../enemies/shared/Enemy.js").Enemy>}
   */
  #ownership = new WeakSet();
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #handle;
  /**
   * @type {WaveDirectorHud}
   */
  #hud;
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({pc, app, definition, runtime}) {
    this.pc = pc;
    this.app = app;
    this.definition = definition;
    this.runtime = runtime;
    this.entity = new pc.Entity(definition.id);
    this.entity.tags.add("map-object", "EnemyWaveDirector");
    this.entity.director = this;
    this.#state = new WaveDirectorState(definition.waveConfig);
    this.#controller = new WaveAiController(definition.waveConfig);
  }
  /**
   * Catalog dependencies are discovered by the normal map asset loader.
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {Array}
   */
  static assetDefinitionsFor(definition = {}) {
    return (definition.waveConfig?.offers ?? WAVE_CONFIG.offers).map(/**
   * @param {{creature:string,cost:number,spawnSeconds:number}} offer
   */
      offer=>({object: offer.creature}));
  }
  onSceneReady() {
    if (this.#handle) {
      return;
    }
    this.#hud = new WaveDirectorHud(this);
    this.#handle = this.app.on("update", this.update, this);
  }
  /**
   * @returns {import("../../waves/WaveDirectorState.js").WaveDirectorState["snapshot"]}
   */
  get snapshot() {
    return this.#state.snapshot;
  }
  /**
   * @returns {string}
   */
  get testStatus() {
    const s = this.snapshot;

    return `${s.controllerId} · ${s.coins} coins\nWave ${s.wave}: ${s.active} alive / ${s.queue.length} preparing\nEarned ${s.earned} · spent ${s.spent}`;
  }
  /**
   * Host-controlled handoff. A future WebSocket adapter can call enqueue on the returned inbox.
   * @param {string} playerId
   * @returns {PlayerWaveController}
   */
  usePlayer(playerId) {
    this.#state.controllerId = playerId;
    this.#controller = new PlayerWaveController();

    return this.#controller;
  }
  useAi() {
    this.#state.controllerId = "ai";
    this.#controller = new WaveAiController(this.definition.waveConfig);
  }
  /**
   * @param {{sequence:number,type:string,creature:string,gateId:string}} command
   * @param {string} controllerId
   */
  submit(command, controllerId) {
    if (this.#destroyed) {
      return {
        accepted: false,
        reason: "closed",
      };
    }
    return this.#state.submit(command, controllerId);
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed || !this.entity.enabled || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    const gates = this.#gates;
    this.#state.gates = gates.map(/**
   * @param {import("../gateway/Gateway.js").Gateway} g
     */
      g=>g.definition.id);
    for (const [id, actor] of this.#units) {
      if (!actor.alive) {
        this.#state.retire(id);
        this.#units.delete(id);
      }
    }
    const s = this.snapshot;
    if (this.definition.autoplay !== false || s.controllerId !== "ai") {
      for (const command of this.#controller.commands(s)) {
        this.submit(command, s.controllerId);
      }
    }
    this.#state.advance(dt, this.#spawn.bind(this));
    this.#hud?.update(this.snapshot);
  }
  /**
   * @returns {Array}
   */
  get #gates() {
    const map = this.runtime.mapData;
    const gates = [...this.runtime.objects].filter(/**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} o
     */
      o=>typeof o.entrancePath === "function" && o.definition?.id && o.entity.enabled);

    return gates.filter(/**
   * @param {import("../gateway/Gateway.js").Gateway} g
     */
      g=>{
        if (!map?.paths?.length) {
          return true;
        }
        const entry = g.definition.entry;

        return map.paths.some(/**
   * @param {{entry:{col:number,rows:number[]},route:Array}} p
       */
          p=>p.entry.col === entry.col && p.entry.rows[0] === entry.rows[0] && p.route.length > 1);
      });
  }
  /**
   * @param {{orderId:string,creature:string,gateId:string}} order
   * @returns {string|false|null}
   */
  #spawn(order) {
    const gate = this.#gates.find(/**
   * @param {import("../gateway/Gateway.js").Gateway} g
     */
      g=>g.definition.id === order.gateId);
    if (!gate) {
      return false;
    }
    if (gate.arrivalCount > 0) {
      return null;
    }
    const id = `${this.definition.id}-${order.orderId}`;
    try {
      const actor = this.runtime.spawnObject({
        id,
        object: order.creature,
        gatewayId: order.gateId,
        directorId: this.definition.id,
        position: {...gate.entrancePath(.42).from},
      });
      if (!actor) {
        return false;
      }
      actor.commander = this;
      this.#units.set(id, actor);
      this.#ownership.add(actor);

      return id;
    } catch (error) {
      this.runtime.onRuntimeError?.(error);

      return false;
    }
  }
  /**
   * Trusted target-death hooks; player commands cannot grant currency.
   * @param {import("../enemies/shared/Enemy.js").Enemy} source
   * @param {{entity?:import("playcanvas").Entity,alive?:boolean,broken?:boolean,commander?:EnemyWaveDirector}} target
   * @param {"kill"|"break"} kind
   * @returns {number}
   */
  recordOutcome(source, target, kind) {
    if (this.#destroyed || !this.#ownership.has(source) || source === target || target.commander === this) {
      return 0;
    }
    if (kind === "kill" && target.alive !== false || kind === "break" && target.broken !== true) {
      return 0;
    }
    const targetId = target.entity?.getGuid();

    return targetId ? this.#state.reward(source.definition.id, targetId, kind) : 0;
  }
  destroy() {
    this.#destroyed = true;
    this.#handle?.off();
    this.#hud?.destroy();
    for (const actor of this.#units.values()) {
      if (actor.alive) {
        actor.destroy();
      }
    }
    this.#units.clear();
    this.entity.destroy();
  }
}
