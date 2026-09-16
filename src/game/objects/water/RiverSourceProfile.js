// Sample one world-space pressure field on both sides of source-cell seams.
export class RiverSourceProfile {
  #source;
  #flow;
  #outlet;
  #outgoing;

  constructor(cells) {
    this.#source = cells[0];
    this.#outlet = cells[1] ?? cells[0];
    this.#flow = this.#direction(this.#source.direction);
    this.#outgoing = this.#direction(this.#outlet.direction);
  }

  sample(col, row) {
    const distance = Math.max(0,
      (col - this.#source.col) * this.#flow[0] +
      (row - this.#source.row) * this.#flow[1] + 0.5,
    );
    const strength = distance <= 1
      ? this.#smooth(distance)
      : 1 - this.#smooth((distance - 1) / 0.86);
    const exitDistance = 0.5 -
      (col - this.#outlet.col) * this.#outgoing[0] -
      (row - this.#outlet.row) * this.#outgoing[1];
    return [
      strength * this.#smooth(exitDistance / 0.25),
      distance <= 1 ? distance * 0.42 : 0.42 + Math.min(1, distance - 1) * 0.58,
    ];
  }

  #smooth(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
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
