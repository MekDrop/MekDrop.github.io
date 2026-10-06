import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

/**
 * Grow fixed-size leaves along face-local stems rather than stretching foliage.
 * @param {{height: number, seed: string}} options
 */
export function createCliffVineGrowth({ height, seed }) {
  const random = new GenerationRandom(seed);
  const crownScale = random.rng(88, 108) / 100;
  const stems = [];
  const leaves = [];
  const count = random.rng(2, 3);
  for (let trail = 0; trail < count; trail++) {
    const coverage = height <= 1.25
      ? (trail === 0 ? 0.99 : random.rng(91, 98) / 100)
      : (trail === 0 ? 0.94 : random.rng(50, 85) / 100);
    const length = height * coverage;
    const base = (trail - (count - 1) / 2) * 0.15 + random.rng(-2, 2) / 100;
    const phase = random.rng(0, 628) / 100;
    const drift = random.rng(-4, 4) / 100;
    /**
     * @param {number} distance
     */
    const point = (distance) => ({
      x: base + Math.sin(distance * 4 + phase) * 0.025 + drift * distance / length,
      y: -distance,
      z: 0.035 + Math.sin(distance * 3 + phase) * 0.009,
    });
    const steps = Math.ceil(length / 0.075);
    const root = point(0);
    stems.push({ start: { x: root.x, y: 0.006, z: -0.06 }, end: root });
    for (let index = 0; index < steps; index++) {
      stems.push({ start: point(index * length / steps), end: point((index + 1) * length / steps) });
    }
    let index = 0;
    for (let distance = 0.06; distance < length - 0.13; distance += random.rng(11, 17) / 100) {
      const position = point(distance);
      const scale = random.rng(78, 108) / 100;
      leaves.push({ ...position, scale, shade: random.rng(0, 2), pitch: -random.rng(18, 38), yaw: random.rng(-25, 25), roll: (index++ % 2 ? -1 : 1) * random.rng(20, 55) });
    }
  }
  return { stems, leaves, crownScale };
}
