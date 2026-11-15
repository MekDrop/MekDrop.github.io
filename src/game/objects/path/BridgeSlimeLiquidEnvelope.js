import { SLIME_BRIDGE_GROWTH_SECONDS, slimeBridgeTransferProgress } from "./BridgeSlimeTiming.js";

/**
 * Join transferred visual material to the same liquid skin as admitted native
 * tissue. These pending regions never enter physics or traversal metadata.
 * @param {{pc: typeof import("playcanvas"), transform: import("playcanvas").Mat4, nativePoses: Map<number, object>, arrivals: object[], poolTransfers: object[], poolSources: Map<number, import("playcanvas").Vec3>}} options
 * @param {typeof import("playcanvas")} options.pc
 * @param {import("playcanvas").Mat4} options.transform
 * @param {Map<number, object>} options.nativePoses
 * @param {object[]} options.arrivals
 * @param {object[]} options.poolTransfers
 * @param {Map<number, import("playcanvas").Vec3>} options.poolSources
 * @returns {Map<number, object>}
 */
export function bridgeSlimeLiquidEnvelope({ pc, transform, nativePoses, arrivals, poolTransfers, poolSources }) {
  const poses = new Map(nativePoses);
  const banks = new Map();
  const permanent = [...nativePoses].filter(/**
   *
   * @param {[number, object]} entry
   */
    (entry) => !entry[1].reservoir).sort(/**
   *
   * @param {[number, object]} a
   * @param {[number, object]} b
   */
    (a, b) => a[0] - b[0]);
  for (const transfer of poolTransfers) {
    const neighbor = nativePoses.get(transfer.station + 1) ?? nativePoses.get(transfer.station - 1);
    const source = transfer.source;
    const direction = (neighbor?.position ?? transfer.target ?? source.clone().add(new pc.Vec3(1, 0, 0))).clone().sub(source);
    direction.y = 0;
    direction.normalize();
    banks.set(transfer.station, {
      source,
      direction,
      units: (banks.get(transfer.station)?.units ?? 0) + (transfer.id?.bridgeLiquidVisualOwned || transfer.id?.setBridgeLiquidOwnership ? 1 : transfer.progress),
      outlet: (transfer.target ?? source).clone().add(direction.clone().mulScalar(0.45)),
    });
  }
  for (const [station, source] of poolSources) {
    if (!nativePoses.get(station)?.reservoir || banks.has(station)) {
      continue;
    }
    const neighbor = nativePoses.get(station + 1) ?? nativePoses.get(station - 1);
    const direction = (neighbor?.position ?? nativePoses.get(station).position).clone().sub(source);
    direction.y = 0;
    direction.normalize();
    banks.set(station, {
      source,
      direction,
      units: 0,
      outlet: nativePoses.get(station).position.clone().add(direction.clone().mulScalar(0.45)),
    });
  }
  for (const arrival of arrivals) {
    if (!arrival.bankFeed || arrival.complete || nativePoses.has(arrival.station)) {
      continue;
    }
    const source = transform.transformPoint(arrival.source);
    const target = transform.transformPoint(arrival.target);
    const direction = target.clone().sub(source);
    direction.y = 0;
    direction.normalize();
    const forward = Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 : direction.z > 0;
    const step = forward ? 1 : -1;
    const bankStation = (forward ? permanent[0]?.[0] : permanent.at(-1)?.[0]) ?? arrival.station;
    const bankIndex = bankStation - step;
    const age = arrival.age / SLIME_BRIDGE_GROWTH_SECONDS;
    const travel = Math.max(0, Math.min(1, (age - 0.34) / 0.55));
    const advance = travel * travel * (3 - 2 * travel);
    const units = arrival.liquidSourceOwned ? 1 : Math.min(0.999, slimeBridgeTransferProgress(arrival.age));
    const bank = banks.get(bankIndex);
    if (units * (1 - advance) > 0.00001) {
      banks.set(bankIndex, {
        source,
        direction,
        units: (bank?.units ?? 0) + units * (1 - advance),
        outlet: source.clone().add(direction.clone().mulScalar(0.45)),
      });
    }
    if (advance <= 0.001) {
      continue;
    }
    const previous = nativePoses.get(arrival.station - step);
    const start = previous ? (forward ? previous.end : previous.start).clone() : target.clone().sub(direction.clone().mulScalar(0.5));
    const end = new pc.Vec3().lerp(start, target.clone().add(direction.clone().mulScalar(0.5)), advance);
    const volume = units * advance;
    poses.set(arrival.station, {
      position: new pc.Vec3().lerp(start, end, 0.5),
      start: forward ? start : end,
      end: forward ? end : start,
      width: Math.max(0.18, (previous?.width ?? 1) * Math.cbrt(volume)),
      thickness: Math.max(0.18, (previous?.thickness ?? 1) * Math.cbrt(volume)),
      volume,
      fluid: true,
      liquidJoinPrevious: forward,
      linkedPrevious: forward,
    });
    if (!forward && poses.has(arrival.station + 1)) {
      poses.set(arrival.station + 1, {
        ...poses.get(arrival.station + 1),
        liquidJoinPrevious: true,
      });
    }
  }
  for (const [station, bank] of banks) {
    const forward = Math.abs(bank.direction.x) > Math.abs(bank.direction.z) ? bank.direction.x > 0 : bank.direction.z > 0;
    const step = forward ? 1 : -1;
    const existing = nativePoses.get(station);
    const neighbor = poses.get(station + step);
    if (!neighbor && !bank.outlet) {
      continue;
    }
    const outlet = neighbor ? (forward ? neighbor.start : neighbor.end).clone() : bank.outlet;
    const outer = bank.source.clone().sub(bank.direction.clone().mulScalar(0.45));
    const volume = (existing?.volume ?? 0) + bank.units;
    const scale = Math.cbrt(Math.max(0.001, volume));
    poses.set(station, {
      ...existing,
      position: new pc.Vec3().lerp(outer, outlet, 0.5),
      start: forward ? outer : outlet,
      end: forward ? outlet : outer,
      width: 1.1 * scale,
      thickness: 1.8 * scale,
      volume,
      fluid: existing ? existing.fluid === true : true,
      reservoir: true,
      flowDirection: step,
      liquidJoinPrevious: !forward,
    });
    if (forward && neighbor) {
      poses.set(station + 1, {
        ...neighbor,
        liquidJoinPrevious: true,
      });
    }
  }

  return poses;
}
