/**
 * @typedef {{orderId:string,creature:string,gateId:string,cost:number,readyAt:number}} WaveOrder
 */
import { WAVE_CONFIG } from "./wave-config.js";

/**
 * Authoritative match economy. Plain command/snapshot data can cross a network boundary.
 */
export class WaveDirectorState {
  /**
   * @type {typeof WAVE_CONFIG}
   */
  #config;
  /**
   * @type {number}
   */
  #coins;
  /**
   * @type {number}
   */
  #clock = 0;
  /**
   * @type {WaveOrder[]}
   */
  #queue = [];
  /**
   * @type {Map<string,{alive:boolean,orderId:string}>}
   */
  #units = new Map();
  /**
   * @type {Set<string>}
   */
  #rewarded = new Set();
  /**
   * @type {string[]}
   */
  #gates = [];
  /**
   * @type {Map<string,number>}
   */
  #lastSequence = new Map();
  /**
   * @type {string}
   */
  #controllerId = "ai";
  /**
   * @type {number}
   */
  #wave = 0;
  /**
   * @type {number}
   */
  #earned = 0;
  /**
   * @type {number}
   */
  #spent = 0;

  /**
   * @param {Partial<typeof WAVE_CONFIG>} config
   */
  constructor(config = {}) {
    this.#config = structuredClone({
      ...WAVE_CONFIG,
      ...config,
    });
    this.#coins = this.#config.initialCoins;
  }

  /**
   * Trusted host handoff; already purchased orders retain their reservation.
   * @param {string} id
   */
  set controllerId(id) {
    this.#controllerId = id;
  }
  /**
   * @param {string[]} gates
   */
  set gates(gates) {
    this.#gates = [...new Set(gates)].sort();
  }

  /**
   * @returns {{coins:number,clock:number,wave:number,earned:number,spent:number,controllerId:string,nextSequence:number,gates:string[],offers:Array,queue:Array,active:number,maxActive:number,maxQueued:number}}
   */
  get snapshot() {
    return structuredClone({
      coins: this.#coins,
      clock: this.#clock,
      wave: this.#wave,
      earned: this.#earned,
      spent: this.#spent,
      controllerId: this.#controllerId,
      nextSequence: (this.#lastSequence.get(this.#controllerId) ?? 0) + 1,
      gates: this.#gates,
      offers: this.#config.offers,
      queue: this.#queue,
      active: [...this.#units.values()].filter(/**
   * @param {{alive:boolean}} u
       */
        u=>u.alive).length,
      maxActive: this.#config.maxActive,
      maxQueued: this.#config.maxQueued,
    });
  }

  /**
   * @param {{sequence:number,type:string,creature:string,gateId:string}} command
   * @param {string} controllerId
   * @returns {{accepted:boolean,reason:string,orderId?:string}}
   */
  submit(command, controllerId) {
    if (controllerId !== this.#controllerId) {
      return {
        accepted: false,
        reason: "not-controller",
      };
    }
    if (!command || !Number.isSafeInteger(command.sequence) || command.sequence <= (this.#lastSequence.get(controllerId) ?? 0)) {
      return {
        accepted: false,
        reason: "stale-command",
      };
    }
    if (command.type !== "buy") {
      return {
        accepted: false,
        reason: "unknown-command",
      };
    }
    const offer = this.#config.offers.find(/**
   * @param {WaveOrder|{creature:string,cost:number,spawnSeconds:number}} o
     */
      o=>o.creature === command.creature);
    if (!offer) {
      return {
        accepted: false,
        reason: "unknown-creature",
      };
    }
    if (!this.#gates.includes(command.gateId)) {
      return {
        accepted: false,
        reason: "invalid-gate",
      };
    }
    if (this.#queue.length >= this.#config.maxQueued) {
      return {
        accepted: false,
        reason: "queue-full",
      };
    }
    if (this.#coins < offer.cost) {
      return {
        accepted: false,
        reason: "insufficient-coins",
      };
    }
    const previous = this.#queue.filter(/**
   * @param {WaveOrder|{creature:string,cost:number,spawnSeconds:number}} o
     */
      o=>o.gateId === command.gateId).at(-1);
    const orderId = `${controllerId}:${command.sequence}`;
    if (!this.#queue.length) {
      this.#wave += 1;
    }
    this.#queue.push({
      orderId,
      creature: offer.creature,
      gateId: command.gateId,
      cost: offer.cost,
      readyAt: Math.max(this.#clock, previous?.readyAt ?? 0) + offer.spawnSeconds,
    });
    this.#coins -= offer.cost;
    this.#spent += offer.cost;
    this.#lastSequence.set(controllerId, command.sequence);

    return {
      accepted: true,
      reason: "queued",
      orderId,
    };
  }

  /**
   * A failed spawn returns its reservation; an occupied gate returns null to keep waiting.
   * @param {number} dt
   * @param {(order: {orderId:string,creature:string,gateId:string})=>string|false|null} spawn
   */
  advance(dt, spawn) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.#clock += dt;
    for (const order of [...this.#queue]) {
      if (!this.#gates.includes(order.gateId)) {
        this.#refund(order); continue;
      }
      if (order.readyAt > this.#clock || this.snapshot.active >= this.#config.maxActive) {
        continue;
      }
      const unitId = spawn({...order});
      if (unitId === null) {
        continue;
      }
      if (unitId === false) {
        this.#refund(order); continue;
      }
      this.#queue.splice(this.#queue.indexOf(order), 1);
      this.#units.set(unitId, {
        alive: true,
        orderId: order.orderId,
      });
      break;
    }
  }

  /**
   * Trusted simulation only; never accepted through submit().
   * @param {string} unitId
   * @param {string} targetId
   * @param {"kill"|"break"} kind
   * @returns {number}
   */
  reward(unitId, targetId, kind) {
    if (!this.#units.has(unitId) || !targetId || this.#rewarded.has(targetId)) {
      return 0;
    }
    const amount = kind === "kill" ? this.#config.killReward : kind === "break" ? this.#config.breakReward : 0;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return 0;
    }
    this.#rewarded.add(targetId);
    this.#coins += amount;
    this.#earned += amount;

    return amount;
  }

  /**
   * @param {string} unitId
   */
  retire(unitId) {
    const unit = this.#units.get(unitId); if (unit) {
      unit.alive = false;
    }
  }
  /**
   * @param {{cost:number}} order
   */
  #refund(order) {
    this.#queue.splice(this.#queue.indexOf(order), 1);
    this.#coins += order.cost;
    this.#spent -= order.cost;
  }
}
