/**
 * Shared bell recording and its browser-selectable encodings.
 */
export class SignalBellAudio {
  /**
   * @returns {string}
   */
  static get wavUrl() {
    return new URL("./signal-bell.wav", import.meta.url).href;
  }

  /**
   * @returns {string}
   */
  static get oggUrl() {
    return new URL("./signal-bell.ogg", import.meta.url).href;
  }
}
