import { RIVER_KIND } from '../../enum/RiverKind.js';
import { RiverImpactFlow } from './RiverImpactFlow.js';

// Route metadata is sampled by world cell, so paint never resets at mesh edges.
export class RiverFlowMap {
  #texture;
  #impactTexture;
  #bankTexture;
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
    const resolution = 16;
    const width = cols * resolution;
    const height = rows * resolution;
    this.#impactTexture = new pc.Texture(device, {
      name: 'Cascade surface currents', width, height,
      format: pc.PIXELFORMAT_R8_G8_B8_A8, mipmaps: false,
      minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const current = this.#impactTexture.lock();
    for (let pixel = 0; pixel < current.length; pixel += 4) {
      current[pixel] = 128;
      current[pixel + 1] = 128;
    }
    const field = new RiverImpactFlow(riverData);
    this.#bankTexture = new pc.Texture(device, {
      name: 'River closed banks', width: cols, height: rows,
      format: pc.PIXELFORMAT_R8_G8_B8_A8, mipmaps: false,
      minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const banks = this.#bankTexture.lock();
    for (const river of riverData) {
      if (river.kind === RIVER_KIND.LAVA) {
        continue;
      }
      for (const cell of river.cells) {
        banks.set(field.bankMask(cell.col, cell.row).map(closed => closed * 255),
          (cell.row * cols + cell.col) * 4);
        for (let z = 0; z < resolution; z++) {
          for (let x = 0; x < resolution; x++) {
            const flow = field.sample(
              cell.col - 0.5 + (x + 0.5) / resolution,
              cell.row - 0.5 + (z + 0.5) / resolution,
            );
            const pixel = ((cell.row * resolution + z) * width + cell.col * resolution + x) * 4;
            current.set([
              Math.round(128 + flow[0] * 127),
              Math.round(128 + flow[1] * 127),
              Math.round(flow[2] * 255), 255,
            ], pixel);
          }
        }
      }
    }
    this.#impactTexture.unlock();
    this.#bankTexture.unlock();
  }

  apply(material) {
    material.setParameter('uRiverFlowMap', this.#texture);
    material.setParameter('uRiverMapSize', this.#size);
    material.setParameter('uCascadeCurrentMap', this.#impactTexture);
    material.setParameter('uRiverBankMap', this.#bankTexture);
  }

  destroy() {
    this.#texture.destroy();
    this.#impactTexture.destroy();
    this.#bankTexture.destroy();
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
