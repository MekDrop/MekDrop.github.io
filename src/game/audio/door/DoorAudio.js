/**
 * Short CC0 timber cues derived from the castle's licensed source recordings.
 */
export class DoorAudio {
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static scratch = {
    wavUrl: new URL("./doorClawScratch.wav", import.meta.url).href,
    oggUrl: new URL("./doorClawScratch.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static collapse = {
    wavUrl: new URL("./doorTimberCollapse.wav", import.meta.url).href,
    oggUrl: new URL("./doorTimberCollapse.ogg", import.meta.url).href,
  };

  /**
   * @type {string}
   */
  static provenanceUrl = new URL("./provenance.json", import.meta.url).href;

  /**
   * @returns {{wavUrl:string,oggUrl:string}[]}
   */
  static get sources() {
    return [DoorAudio.scratch, DoorAudio.collapse];
  }
}
