import { WaveDirectorState } from "../../waves/WaveDirectorState.js";
import { WaveAiController } from "../../waves/WaveAiController.js";
import { PlayerWaveController } from "../../waves/PlayerWaveController.js";
import { WAVE_CONFIG } from "../../waves/wave-config.js";
import { WaveDirectorHud } from "../../ui/WaveDirectorHud.js";
import { ENEMY_TRAVERSAL } from "../../enum/EnemyTraversal.js";

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
   * @type {Map<import("../enemies/shared/Enemy.js").Enemy,{key:string,started:number,expired:boolean}>}
   */
  #repairWorkers = new Map();
  /**
   * @type {Map<string,number>}
   */
  #repairRetryAt = new Map();
  /**
   * @type {WeakMap<import("../../GameContracts.js").GameMapData["enemyNavigation"],Map<string,{signature:string,reachable:boolean}>>}
   */
  #bankRoutes = new WeakMap();
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
    this.#updateRepairWorkers();
    this.#state.rebuildOrders = this.#rebuildOrders(gates, this.snapshot);
    const s = this.snapshot;
    if (this.definition.autoplay !== false || s.controllerId !== "ai") {
      const rebuildOrders = this.#controller instanceof WaveAiController ? this.#rebuildOrders(gates, s) : null;
      for (const command of this.#controller.commands(s, rebuildOrders)) {
        this.submit(command, s.controllerId);
      }
    }
    this.#state.advance(dt, this.#spawn.bind(this));
    this.#hud?.update(this.snapshot);
  }
  /**
   * @param {import("../gateway/Gateway.js").Gateway[]} gates
   * @param {WaveDirectorState["snapshot"]} snapshot
   * @returns {Array<{creature:string,count:number,gateId:string,dispatchCount:number}>|null}
   */
  #rebuildOrders(gates, snapshot) {
    const demands = this.#rebuildDemands;
    if (!demands.length) {
      return null;
    }
    const reserved = new Map();
    const liveReserved = new Map();
    for (const order of snapshot.queue) {
      const key = `${order.gateId}:${order.creature}`;
      reserved.set(key, (reserved.get(key) ?? 0) + 1);
    }
    for (const [actor, worker] of this.#repairWorkers) {
      if (actor.alive && !worker.expired && !actor.rebuildContributionConsumed) {
        const key = worker.key;
        reserved.set(key, (reserved.get(key) ?? 0) + 1);
        liveReserved.set(key, (liveReserved.get(key) ?? 0) + 1);
      }
    }
    const orders = [];
    const targets = [];
    for (const demand of demands) {
      targets.push(...this.#repairTargets(demand, gates));
    }
    for (const { demand, gate: closest } of targets) {
      if (closest) {
        const key = `${closest.definition.id}:${demand.creature}`;
        const available = reserved.get(key) ?? 0;
        const used = Math.min(available, demand.count);
        reserved.set(key, available - used);
        const live = liveReserved.get(key) ?? 0;
        const usedLive = Math.min(live, demand.count);
        liveReserved.set(key, live - usedLive);
        let workers = 0;
        for (const [actor, worker] of this.#repairWorkers) {
          workers += Number(actor.alive && !actor.rebuildContributionConsumed && worker.key === key);
        }
        // Bound stalled approaches, not identities already contributing gel.
        // Completed deck and temporary bank tissue must never consume the
        // rescue budget needed to finish a longer span.
        const capacity = Math.max(0, demand.count * 3 - workers);
        const retrying = snapshot.clock >= (this.#repairRetryAt.get(key) ?? 0);
        orders.push({
          creature: demand.creature,
          count: retrying ? Math.min(demand.count - used, capacity) : 0,
          gateId: closest.definition.id,
          dispatchCount: retrying ? Math.min(demand.count - usedLive, capacity) : 0,
        });
      }
    }

    return orders;
  }

  /**
   * Split only when both real banks have a reachable gate on their own side.
   * Otherwise retain the original nearest-gate single-bank attempt.
   * @param {import("../path/Bridge.js").BridgeRebuildDemand} demand
   * @param {import("../gateway/Gateway.js").Gateway[]} gates
   * @returns {Array<{demand:import("../path/Bridge.js").BridgeRebuildDemand,gate:import("../gateway/Gateway.js").Gateway|null}>}
   */
  #repairTargets(demand, gates) {
    const banks = demand.banks ?? [];
    const split = [];
    if (banks.length > 0 && banks.length <= 2) {
      for (let index = 0; index < banks.length; index++) {
        const bank = banks[index];
        const gate = this.#closestRepairGate(bank.position, gates, bank, banks[1 - index] ?? null);
        if (gate) {
          split.push({
            demand: {
              ...demand,
              ...bank,
            },
            gate,
          });
        }
      }
    }
    return split.length === 2 ? split : [{
      demand,
      gate: split[0]?.gate ?? this.#closestRepairGate(demand.position, gates),
    }];
  }

  /**
   * @param {import("playcanvas").Vec2} target
   * @param {import("../gateway/Gateway.js").Gateway[]} gates
   * @param {import("../path/Bridge.js").BridgeRebuildBank|null} bank
   * @param {import("../path/Bridge.js").BridgeRebuildBank|null} opposite
   * @returns {import("../gateway/Gateway.js").Gateway|null}
   */
  #closestRepairGate(target, gates, bank = null, opposite = null) {
    let closest = null;
    let distance = Infinity;
    for (const gate of gates) {
      const position = gate.entrancePath(0.42).from;
      const candidate = Math.hypot(position.x - target.x, position.z - target.y);
      if (bank && ((opposite && candidate >= Math.hypot(position.x - opposite.position.x, position.z - opposite.position.y)) ||
        !this.#gateReachesBank(gate, bank))) {
        continue;
      }
      if (candidate < distance) {
        closest = gate;
        distance = candidate;
      }
    }

    return closest;
  }

  /**
   * @param {import("../gateway/Gateway.js").Gateway} gate
   * @param {import("../path/Bridge.js").BridgeRebuildBank} bank
   * @returns {boolean}
   */
  #gateReachesBank(gate, bank) {
    const map = this.runtime.mapData;
    const navigation = map?.enemyNavigation;
    const graph = navigation?.graphs?.get(ENEMY_TRAVERSAL.WALKING);
    if (!graph) {
      return false;
    }
    const entrance = gate.entrancePath(0.42);
    const startPosition = entrance.to ?? entrance.from;
    const key = `${gate.definition.id}:${bank.position.toString()}`;
    const signature = `${startPosition.toString()}:${bank.elevation}`;
    let cached = this.#bankRoutes.get(navigation);
    if (!cached) {
      cached = new Map();
      this.#bankRoutes.set(navigation, cached);
    }
    const previous = cached.get(key);
    if (previous?.signature === signature) {
      return previous.reachable;
    }
    const start = this.#walkingNode(startPosition, graph, navigation.points);
    const target = this.#walkingNode(new this.pc.Vec3(bank.position.x, bank.elevation, bank.position.y), graph, navigation.points);
    const visited = new Set(start ? [start] : []);
    const pending = start ? [start] : [];
    for (let index = 0; index < pending.length; index++) {
      for (const next of graph.get(pending[index]) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          pending.push(next);
        }
      }
    }
    const reachable = target !== null && visited.has(target);
    cached.set(key, {
      signature,
      reachable,
    });

    return reachable;
  }

  /**
   * Do not snap across a gap or onto a different floor to invent gate access.
   * @param {import("playcanvas").Vec3} position
   * @param {Map<string,Set<string>>} graph
   * @param {Map<string,import("../../navigation/WalkingPaths.js").WalkingPoint>} points
   * @returns {string|null}
   */
  #walkingNode(position, graph, points) {
    const map = this.runtime.mapData;
    let closest = null;
    let distance = 1.25;
    for (const [key, point] of points) {
      if (!graph.get(key)?.size || Math.abs(point.elevation - position.y) > 0.4) {
        continue;
      }
      const candidate = Math.hypot(point.col - (map.cols - 1) / 2 - position.x,
        point.row - (map.rows - 1) / 2 - position.z);
      if (candidate < distance) {
        closest = key;
        distance = candidate;
      }
    }

    return closest;
  }
  /**
   * Expired workers remain alive; release their reservations before a relief batch.
   */
  #updateRepairWorkers() {
    const clock = this.snapshot.clock;
    for (const [actor, worker] of this.#repairWorkers) {
      if (!actor.alive) {
        this.#repairWorkers.delete(actor);
      } else if (!actor.rebuildContributionConsumed && !worker.expired && clock - worker.started >= 180) {
        worker.expired = true;
        actor.releaseRebuildAssignment?.();
        this.#repairRetryAt.set(worker.key, clock + 10);
      }
    }
  }
  /**
   * @returns {import("../path/Bridge.js").BridgeRebuildDemand[]}
   */
  get #rebuildDemands() {
    return [...this.runtime.objects].map(/**
     * @param {import("../path/Bridge.js").Bridge} object
     */
      (object) => object.rebuildDemand).filter(Boolean);
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
        if (!map?.paths?.length || this.#rebuildDemands.length > 0) {
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
    const rebuildOrders = this.#rebuildOrders(this.#gates, this.snapshot);
    if (rebuildOrders !== null) {
      const permitted = rebuildOrders.some(/**
       * @param {{creature:string,gateId:string}} repair
       */
        (repair) => repair.creature === order.creature && repair.gateId === order.gateId);
      if (!permitted) {
        return null;
      }
    }
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
      if (rebuildOrders !== null) {
        this.#repairWorkers.set(actor, {
          key: `${order.gateId}:${order.creature}`,
          started: this.snapshot.clock,
          expired: false,
        });
      }

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
