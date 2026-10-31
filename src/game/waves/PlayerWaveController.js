/**
 * Network transport can enqueue decoded player commands; authority stays in WaveDirectorState.
 */
export class PlayerWaveController {
  /**
   * @type {Array}
   */
  #pending = [];
  /**
   * @param {{sequence:number,type:string,creature:string,gateId:string}} command
   * @returns {boolean}
   */
  enqueue(command) {
    if (this.#pending.length >= 32) {
      return false;
    }
    this.#pending.push(structuredClone(command));

    return true;
  }
  /**
   * @returns {Array}
   */
  commands() {
    return this.#pending.splice(0);
  }
}
