import { RIVER_KIND } from '../../enum/RiverKind.js';

// Route metadata is sampled by world cell, so paint never resets at mesh edges.
export class RiverFlowMap {
  #texture;
  #size;

  constructor(pc, device, mapData) {
    const { cols, rows, riverData = [] } = mapData;
    this.#size = [cols, rows];
    this.#texture = new pc.Texture(device, {
      name: 'River flow coordinates', width: cols, height: rows,
      format: pc.PIXELFORMAT_RGBA32F, mipmaps: false,
      minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const data = this.#texture.lock();
    for (const river of riverData) {
      if (river.kind === RIVER_KIND.LAVA) {
        continue;
      }
      for (const [index, cell] of river.cells.entries()) {
        const outgoing = this.#direction(cell.direction);
        const incoming = this.#direction(river.cells[index - 1]?.direction ?? cell.direction);
        const turn = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
        data.set([index, ...outgoing, turn], (cell.row * cols + cell.col) * 4);
      }
    }
    this.#texture.unlock();
  }

  apply(material) {
    material.setParameter('uRiverFlowMap', this.#texture);
    material.setParameter('uRiverMapSize', this.#size);
  }

  destroy() {
    this.#texture.destroy();
  }

  #direction(direction) {
    switch (direction) {
      case 'NORTH': return [0, -1];
      case 'EAST': return [1, 0];
      case 'SOUTH': return [0, 1];
      default: return [-1, 0];
    }
  }
}
