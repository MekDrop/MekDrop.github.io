/**
 * Sourced slime and splash effects by rubberduck (CC0, OpenGameArt).
 * Original files and provenance live alongside the game's audio encodings.
 */
export class LatchSlugAudio {
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static jump = {
    wavUrl: new URL("./jump.wav", import.meta.url).href,
    oggUrl: new URL("./jump.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static splash = {
    wavUrl: new URL("./splash.wav", import.meta.url).href,
    oggUrl: new URL("./splash.ogg", import.meta.url).href,
  };

  /**
   * @returns {{wavUrl:string,oggUrl:string}[]}
   */
  static get sources() {
    return [LatchSlugAudio.jump, LatchSlugAudio.splash];
  }
}
