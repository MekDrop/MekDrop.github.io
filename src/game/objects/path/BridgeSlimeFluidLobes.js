import { SLIME_BRIDGE_GROWTH_SECONDS } from "./BridgeSlimeTiming.js";

/**
 * @typedef {{position:import("playcanvas").Vec3,start:import("playcanvas").Vec3,end:import("playcanvas").Vec3,volume?:number,width?:number,thickness?:number,reservoir?:boolean,linkedPrevious?:boolean}} FluidPose
 * @typedef {{bankFeed:boolean,complete:boolean,station:number,source:import("playcanvas").Vec3,target:import("playcanvas").Vec3,age:number,sourceOwner?:import("../enemies/latch-slug/LatchSlug.js").LatchSlug}} FluidArrival
 * @typedef {{id:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,source:import("playcanvas").Vec3,target?:import("playcanvas").Vec3,station:number,progress:number}} FluidTransfer
 * @typedef {{owner:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,position:import("playcanvas").Vec3,soft:number}} FluidFace
 * @typedef {{pc:typeof import("playcanvas"),transform:import("playcanvas").Mat4,nativePoses:Map<number,FluidPose>,arrivals:FluidArrival[],poolTransfers:FluidTransfer[],poolSources:Map<number,import("playcanvas").Vec3>,time:number,finishAge:number,flowActive:boolean}} FluidLobeOptions
 */

/**
 * Build material lobes from real admitted tissue and whole donating identities.
 * A donation stays at the shore while softening, then travels along the actual
 * native spine. It is never simultaneously represented at bank and frontier.
 * @param {FluidLobeOptions} options
 * @param {typeof import("playcanvas")} options.pc
 * @param {import("playcanvas").Mat4} options.transform
 * @param {Map<number,FluidPose>} options.nativePoses
 * @param {FluidArrival[]} options.arrivals
 * @param {FluidTransfer[]} options.poolTransfers
 * @param {Map<number,import("playcanvas").Vec3>} options.poolSources
 * @param {number} options.time
 * @param {number} options.finishAge
 * @param {boolean} options.flowActive
 * @returns {{lobes:Array<{center:number[],radii:number[],weight:number}>,volume:number,faces:FluidFace[],settled:boolean,transports:Array<{station:number,position:number[],progress:number,distance:number,totalLength:number}>}}
 */
export function bridgeSlimeFluidLobes({ pc, transform, nativePoses, arrivals, poolTransfers, poolSources, time, finishAge, flowActive }) {
  const inverse = transform.clone().invert();
  const lobes = [], faces = [];
  const transports = [];
  const finish = Math.max(0, Math.min(1, finishAge / 1.2));
  let units = 0;
  /**
   * @param {import("playcanvas").Vec3} center
   * @param {number[]} radii
   * @param {number} [weight]
   */
  const add = (center, radii, weight = 1) => lobes.push({
    center: center.toArray(),
    radii,
    weight,
  });
  /**
   * @param {import("playcanvas").Vec3} center
   * @param {import("playcanvas").Vec3} axis
   * @param {number} scale
   * @param {number} weight
   */
  const poolFeet = (center, axis, scale, weight) => {
    const across = new pc.Vec3(-axis.z, 0, axis.x);
    const shoulder = center.clone().add(axis.clone().mulScalar(-0.5 * scale)).add(across.clone().mulScalar(0.4 * scale));
    shoulder.y -= 0.025 * scale;
    add(shoulder, [0.65 * scale, 0.12 * scale, 0.65 * scale], weight);
    const finger = center.clone().add(axis.clone().mulScalar(-0.3 * scale)).add(across.clone().mulScalar(-0.7 * scale));
    finger.y -= 0.02 * scale;
    add(finger, Math.abs(axis.x) > Math.abs(axis.z) ? [0.42 * scale, 0.09 * scale, 0.28 * scale] : [0.28 * scale, 0.09 * scale, 0.42 * scale], weight * 0.65);
  };
  /**
   * @param {import("playcanvas").Vec3} center
   * @param {import("playcanvas").Vec3} axis
   * @param {number} weight
   */
  const crest = (center, axis, weight) => {
    const across = new pc.Vec3(-axis.z, 0, axis.x);
    const horizontal = Math.abs(axis.x) > Math.abs(axis.z);
    add(center, horizontal ? [0.55, 0.3, 0.38] : [0.38, 0.3, 0.55], weight);
    add(center.clone().add(axis.clone().mulScalar(-0.22)).add(across.clone().mulScalar(0.1)).add(new pc.Vec3(0, -0.035, 0)), [0.43, 0.24, 0.43], weight);
    add(center.clone().add(axis.clone().mulScalar(0.27)).add(across.clone().mulScalar(-0.07)).add(new pc.Vec3(0, -0.06, 0)), horizontal ? [0.38, 0.18, 0.3] : [0.3, 0.18, 0.38], weight);
  };
  const entries = [...nativePoses].sort(/**
   *
   * @param {[number,FluidPose]} a
   * @param {[number,FluidPose]} b
   */
    (a, b) => a[0] - b[0]);
  for (const [station, pose] of entries) {
    units += pose.volume ?? 1;
    const start = inverse.transformPoint(pose.start), end = inverse.transformPoint(pose.end);
    const center = inverse.transformPoint(pose.position);
    const direction = end.clone().sub(start).normalize();
    const horizontal = Math.abs(direction.x) > Math.abs(direction.z);
    const scale = Math.cbrt(pose.volume ?? 1);
    if (pose.reservoir) {
      const source = poolSources.get(station);
      const shore = source ? inverse.transformPoint(source) : center.clone();
      const pool = new pc.Vec3().lerp(shore, center, 0.25);
      const inlet = center.clone().sub(shore);
      inlet.y = 0;
      inlet.normalize();
      pool.sub(inlet.clone().mulScalar(0.95 * Math.max(0, scale - 1)));
      pool.y = shore.y + 0.12 * 0.92 * scale;
      add(pool, horizontal ? [0.95 * scale, 0.12 * scale, 0.85 * scale] : [0.85 * scale, 0.12 * scale, 0.95 * scale]);
      poolFeet(pool, inlet.length() > 0 ? inlet.normalize() : direction, scale, 1);
      const next = nativePoses.get(station + 1);
      const previous = nativePoses.get(station - 1);
      const linked = next?.linkedPrevious && !next.reservoir ? next : pose.linkedPrevious && previous && !previous.reservoir ? previous : null;
      if (linked) {
        // This meniscus covers an existing native bank joint. It never creates
        // collision or joins a bank whose physical link has been removed.
        const a = inverse.transformPoint(linked.start), b = inverse.transformPoint(linked.end);
        const target = a.distance(center) < b.distance(center) ? a : b;
        const from = new pc.Vec3().lerp(pool, center, 0.6);
        from.y = pool.y;
        const steps = Math.max(1, Math.ceil(from.distance(target) / 0.18));
        for (let step = 0; step <= steps; step++) {
          add(new pc.Vec3().lerp(from, target, step / steps), [0.28, 0.24, 0.28], 0.65);
        }
      }
      continue;
    }
    // Native deep members remain the load-bearing core. The wet upper envelope
    // spreads the same measured material over that core instead of drawing its
    // structural aspect ratio as a vertical curtain. It adds no support surface.
    const width = scale * (0.65 + finish * 0.25);
    const height = Math.max(0.13, 0.16 * scale);
    for (let step = 0; step <= 3; step++) {
      const u = step / 3;
      const p = new pc.Vec3().lerp(start, end, u);
      const material = station + u;
      const pulse = flowActive ? Math.sin(material * 3.3 - time * 1.4) * 0.045 : 0;
      p.y -= height * 0.45;
      p[horizontal ? "z" : "x"] += pulse;
      add(p, horizontal ? [0.4, height, width * (1 + pulse)] : [width * (1 + pulse), height, 0.4]);
    }
    const drip = new pc.Vec3().lerp(start, end, 0.55);
    drip[horizontal ? "z" : "x"] += width * (station % 2 ? -0.75 : 0.75);
    drip.y -= height + 0.08;
    add(drip, [0.09, 0.17, 0.09]);
  }
  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3} source
   * @param {number} melt
   * @param {import("playcanvas").Vec3} target
   * @param {number} [weight]
   * @param {import("playcanvas").Vec3} [axis]
   */
  const sourceLobe = (owner, source, melt, target = source, weight = 1, axis = new pc.Vec3(1, 0, 0)) => {
    const soft = Math.max(0, Math.min(1, melt));
    const center = new pc.Vec3().lerp(source, target, soft);
    const ry = 0.38 - soft * 0.26;
    center.y += ry * 0.92;
    add(center, Math.abs(axis.x) > Math.abs(axis.z) ? [0.44 + soft * 0.51, ry, 0.44 + soft * 0.41] : [0.44 + soft * 0.41, ry, 0.44 + soft * 0.51], weight);
    if (soft > 0.02) {
      poolFeet(center, axis, soft, weight);
    }
    if (owner?.entity && soft < 0.96) {
      faces.push({
        owner,
        position: source.clone(),
        soft,
      });
    }
  };
  for (const transfer of poolTransfers) {
    const source = inverse.transformPoint(transfer.source);
    const pose = nativePoses.get(transfer.station);
    const bank = pose ? inverse.transformPoint(pose.position) : transfer.target ? inverse.transformPoint(transfer.target) : source;
    const target = new pc.Vec3().lerp(source, bank, 0.25);
    target.y = source.y;
    units += 1;
    const axis = bank.clone().sub(source);
    axis.y = 0;
    sourceLobe(transfer.id, source, transfer.progress, target, 1, axis.length() > 0 ? axis.normalize() : new pc.Vec3(1, 0, 0));
  }
  for (const arrival of arrivals) {
    if (!arrival.bankFeed || arrival.complete || nativePoses.has(arrival.station)) {
      continue;
    }
    units += 1;
    const source = arrival.source.clone();
    const target = arrival.target.clone();
    const age = arrival.age;
    const direction = target.clone().sub(source);
    direction.y = 0;
    direction.normalize();
    const melt = Math.max(0, Math.min(1, age / 1.15));
    if (age <= 1.15) {
      sourceLobe(arrival.sourceOwner, source, melt, source, 1, direction);
      crest(source.clone().add(new pc.Vec3(0, 0.075, 0)), direction, 0);
      continue;
    }
    const release = Math.min(1, (age - 1.15) / 0.45);
    if (release < 1) {
      sourceLobe(null, source, 1, source, 1 - release, direction);
    }
    const forward = Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 : direction.z > 0;
    const path = [source.clone()];
    const tissue = entries.filter(/**
     *
     * @param {[number,FluidPose]} entry
     */
      (entry) => !entry[1].reservoir);
    if (!forward) {
      tissue.reverse();
    }
    for (const [, pose] of tissue) {
      path.push(inverse.transformPoint(pose.position));
    }
    path.push(target.clone());
    const travel = Math.max(0, Math.min(1, (age - 1.15) / (SLIME_BRIDGE_GROWTH_SECONDS - 1.35)));
    const lengths = [0];
    for (let i = 1; i < path.length; i++) {
      lengths.push(lengths[i - 1] + path[i].distance(path[i - 1]));
    }
    const distance = travel * lengths.at(-1);
    let segment = 1;
    while (segment < lengths.length - 1 && lengths[segment] < distance) {
      segment++;
    }
    const u = (distance - lengths[segment - 1]) / Math.max(0.001, lengths[segment] - lengths[segment - 1]);
    const bolus = new pc.Vec3().lerp(path[segment - 1], path[segment], u);
    bolus.y += 0.075;
    crest(bolus, direction, release);
    transports.push({
      station: arrival.station,
      position: bolus.toArray(),
      progress: travel,
      distance,
      totalLength: lengths.at(-1),
    });
    // The travelling unit draws a narrowing connected wet neck behind itself.
    for (let i = 1; i <= segment; i++) {
      const end = i === segment ? bolus : path[i];
      const length = path[i - 1].distance(end);
      const count = Math.max(1, Math.ceil(length / 0.18));
      const frontier = i === path.length - 1 && length <= 2;
      for (let step = 0; step <= count; step++) {
        const p = new pc.Vec3().lerp(path[i - 1], end, step / count);
        const width = 0.34 + Math.sin((lengths[i - 1] + step * length / count) * 4.1 - time * 1.3) * 0.025;
        p.y += 0.035;
        // The last neck crosses real moving native height differences. A
        // narrow high-density core survives the coarse extraction grid without
        // thickening the film over the whole established span.
        add(p, frontier ? [0.28, 0.24, 0.28] : [width, 0.12, width], (frontier ? 0.65 : 0.12) * release);
      }
    }
  }

  return {
    lobes,
    volume: units * 0.4888,
    faces,
    settled: !flowActive && finish >= 1,
    transports,
  };
}
