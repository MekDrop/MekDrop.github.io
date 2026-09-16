import { RIVER_KIND } from '../../enum/RiverKind.js';

// A local surface current: spread from the falling sheet, turn at solid banks,
// and merge into the receiving route. It affects paint, not actor movement.
export class RiverImpactFlow {
  #cells = new Map();

  constructor(rivers) {
    for (const river of rivers) {
      if (river.kind === RIVER_KIND.LAVA) {
        continue;
      }
      const impacts = river.cascades.map((cascade) => {
        const flow = this.#direction(cascade.direction);
        const drop = cascade.topElevation - cascade.bottomElevation;
        const forward = 0.565 + Math.min(0.22, drop * 0.22);
        return {
          col: cascade.from.col + flow[0] * forward,
          row: cascade.from.row + flow[1] * forward,
          elevation: cascade.bottomElevation,
          index: river.cells.findIndex((cell) =>
            cell.col === cascade.to.col && cell.row === cascade.to.row),
        };
      });
      for (const [index, cell] of river.cells.entries()) {
        this.#cells.set(`${cell.col},${cell.row}`, { cell, index, impacts, river });
      }
    }
  }

  sample(col, row) {
    const record = this.#cells.get(`${Math.floor(col + 0.5)},${Math.floor(row + 0.5)}`);
    if (!record) {
      return [0, 0, 0];
    }
    const { cell, index, impacts } = record;
    const outgoing = this.#direction(cell.direction);
    let velocity = [outgoing[0] * 0.72, outgoing[1] * 0.72];
    let influence = 0;
    for (const impact of impacts) {
      if (index < impact.index || index > impact.index + 2 ||
        Math.abs(cell.elevation - impact.elevation) > 0.04) {
        continue;
      }
      const dx = col - impact.col;
      const dz = row - impact.row;
      const distance = Math.hypot(dx, dz);
      const weight = 1 - this.#smooth(0.7, 1.65, distance);
      if (weight <= influence) {
        continue;
      }
      const settle = this.#smooth(0.12, 0.72, distance);
      const speed = 0.82 / Math.max(0.055, distance);
      velocity = [
        dx * speed * (1 - settle) + outgoing[0] * 0.72 * settle,
        dz * speed * (1 - settle) + outgoing[1] * 0.72 * settle,
      ];
      influence = weight;
    }
    if (influence === 0) {
      return [0, 0, 0];
    }

    const walls = [];
    const banks = this.bankMask(cell.col, cell.row);
    for (const [side, [nx, nz]] of [[-1, 0], [1, 0], [0, -1], [0, 1]].entries()) {
      if (!banks[side]) {
        continue;
      }
      const distance = 0.5 - (col - cell.col) * nx - (row - cell.row) * nz;
      const blocked = 1 - this.#smooth(0.015, 0.23, distance);
      const intoBank = Math.max(0, velocity[0] * nx + velocity[1] * nz) * blocked;
      velocity[0] += (outgoing[0] - nx) * intoBank;
      velocity[1] += (outgoing[1] - nz) * intoBank;
      walls.push([nx, nz, blocked]);
    }
    // At a corner, redirecting one component must not reintroduce bank penetration.
    for (const [nx, nz, blocked] of walls) {
      const intoBank = Math.max(0, velocity[0] * nx + velocity[1] * nz) * blocked;
      velocity[0] -= nx * intoBank;
      velocity[1] -= nz * intoBank;
    }
    const limit = Math.max(1, Math.hypot(...velocity) / 0.95);
    return [velocity[0] / limit, velocity[1] / limit, influence];
  }

  // Closed sides of the actual receiving cell, including the tall upstream
  // cliff. Angular route UVs cannot describe the extra wall inside an L turn.
  bankMask(col, row) {
    const record = this.#cells.get(`${col},${row}`);
    if (!record) {
      return [0, 0, 0, 0];
    }
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([nx, nz]) => {
      const neighbor = this.#cells.get(`${col + nx},${row + nz}`);
      return neighbor?.river === record.river &&
        Math.abs(neighbor.cell.elevation - record.cell.elevation) <= 0.04 ? 0 : 1;
    });
  }

  #smooth(start, end, value) {
    const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  #direction(direction) {
    switch (direction) {
      case 'NORTH': return [0, -1];
      case 'SOUTH': return [0, 1];
      case 'EAST': return [1, 0];
      default: return [-1, 0];
    }
  }
}
