import { GameObject } from "src/game-objects/core/GameObject";

export class CoinGameObject extends GameObject {
  constructor(coin = {}) {
    super({
      x: 0,
      y: 0,
      r: 0,
      collected: false,
      phase: 0,
      ...coin,
    });

    if (!coin.phase) {
      this.phase = (this.x + this.y) * 0.1;
    }
  }
}
