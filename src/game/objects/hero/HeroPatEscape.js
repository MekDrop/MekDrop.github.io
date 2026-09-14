// A bounded search of connected safe ground. The hero's collision checks still
// own every movement step, including obstacles that change after planning.
export class HeroPatEscape {
  #route = [];
  #target = null;
  #remaining = 0;
  #stalled = 0;
  #previous = null;

  get active() {
    return this.#route.length > 0;
  }

  get target() {
    return this.#target ? { ...this.#target } : null;
  }

  begin(position, canTraverse, random = Math.random, distance = 3) {
    this.reset();
    const desiredDistance = Number.isFinite(distance)
      ? Math.max(3, Math.min(12, distance)) : 3;
    const angle = random() * Math.PI * 2;
    const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    const directTarget = {
      x: position.x + direction.x * desiredDistance,
      z: position.z + direction.z * desiredDistance,
    };
    // A random angle also randomizes the first movement, rather than always
    // taking an axis-aligned first step toward a random grid destination.
    if (canTraverse(position, directTarget)) {
      this.#target = directTarget;
      this.#route = [directTarget];
      this.#start(position);
      return;
    }
    const searchRadius = Math.max(12, Math.ceil(desiredDistance / 0.75) + 4);
    const nodes = [{ x: position.x, z: position.z, col: 0, row: 0, parent: -1 }];
    const seen = new Set(["0,0"]);
    for (let index = 0; index < nodes.length && index < 900; index += 1) {
      const node = nodes[index];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const col = node.col + dx;
        const row = node.row + dz;
        const key = `${col},${row}`;
        if (Math.abs(col) + Math.abs(row) > searchRadius || seen.has(key)) {
          continue;
        }
        const next = {
          x: position.x + col * 0.75,
          z: position.z + row * 0.75,
          col, row, parent: index,
        };
        if (!canTraverse(node, next)) {
          continue;
        }
        seen.add(key);
        nodes.push(next);
      }
    }
    // Pick a narrow distance band, so repeated pats visibly extend the escape
    // instead of randomly choosing a shorter trip. In an enclosure, use the
    // farthest reachable band when the requested distance is unavailable.
    const candidates = nodes.slice(1).map((node, i) => ({
      index: i + 1,
      difference: Math.abs(Math.hypot(node.col, node.row) * 0.75 - desiredDistance),
    }));
    const closest = candidates.reduce((best, node) => Math.min(best, node.difference), Infinity);
    const choices = candidates.filter((node) => node.difference <= closest + 0.15)
      .map((node) => node.index);
    if (!choices.length) {
      return;
    }
    // When the direct run is blocked, use the reachable destination closest
    // to the randomly chosen heading at the requested distance.
    let index = choices.reduce((best, candidate) => {
      const alignment = (i) => {
        const node = nodes[i];
        return (node.col * direction.x + node.row * direction.z) / Math.hypot(node.col, node.row);
      };
      return alignment(candidate) > alignment(best) ? candidate : best;
    });
    this.#target = { x: nodes[index].x, z: nodes[index].z };
    while (index > 0) {
      this.#route.unshift({ x: nodes[index].x, z: nodes[index].z });
      index = nodes[index].parent;
    }
    // Remove grid corners only when the entire shortcut passes the same
    // terrain and collision checks as the original route.
    const route = [];
    let from = position;
    for (let next = 0; next < this.#route.length;) {
      let farthest = this.#route.length - 1;
      while (farthest > next && !canTraverse(from, this.#route[farthest])) {
        farthest -= 1;
      }
      from = this.#route[farthest];
      route.push(from);
      next = farthest + 1;
    }
    this.#route = route;
    this.#start(position);
  }

  #start(position) {
    this.#previous = { ...position };
    let previous = position;
    const length = this.#route.reduce((total, point) => {
      const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
      previous = point;
      return total + distance;
    }, 0);
    this.#remaining = Math.max(5, length / 3 + 1);
  }

  advance(deltaTime, position) {
    if (!this.active) {
      return;
    }
    this.#remaining -= deltaTime;
    const moved = Math.hypot(position.x - this.#previous.x, position.z - this.#previous.z);
    this.#stalled = moved < deltaTime * 0.15 ? this.#stalled + deltaTime : 0;
    this.#previous = { ...position };
    while (this.active && Math.hypot(
      this.#route[0].x - position.x, this.#route[0].z - position.z,
    ) < (this.#route.length > 1 ? 0.025 : 0.16)) {
      this.#route.shift();
    }
    if (this.#remaining <= 0 || this.#stalled > 0.65 || !this.active) {
      this.reset();
    }
  }

  velocity(position, speed) {
    if (!this.active) {
      return { x: 0, z: 0 };
    }
    const x = this.#route[0].x - position.x;
    const z = this.#route[0].z - position.z;
    const length = Math.hypot(x, z);
    if (length < 0.001) {
      return { x: 0, z: 0 };
    }
    const approachSpeed = Math.min(speed, length * 12);
    return { x: x / length * approachSpeed, z: z / length * approachSpeed };
  }

  reset() {
    this.#route = [];
    this.#target = null;
    this.#remaining = 0;
    this.#stalled = 0;
    this.#previous = null;
  }
}
