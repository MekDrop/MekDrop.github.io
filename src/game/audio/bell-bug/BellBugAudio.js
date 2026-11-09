/**
 * Recorded CC0 claw and wet-contact foley; see copyrights.txt.
 */
export class BellBugAudio {
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static fleshScratch = {
    wavUrl: new URL("./flesh-scratch.wav", import.meta.url).href,
    oggUrl: new URL("./flesh-scratch.ogg", import.meta.url).href,
  };

  /**
   * Preserve recorded-source credits in the production asset output.
   * @type {string}
   */
  static attributionUrl = new URL("./copyrights.txt", import.meta.url).href;

  /**
   * @returns {{wavUrl:string,oggUrl:string}[]}
   */
  static get sources() {
    return [BellBugAudio.fleshScratch];
  }
}
