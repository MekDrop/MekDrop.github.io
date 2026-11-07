/**
 * Sourced effects from OpenGameArt; per-cue authors and licenses are recorded here.
 * Original files and provenance live alongside the game's audio encodings.
 */
export class LatchSlugAudio {
  /**
   * Cute creature vocal by rubberduck (CC0), selected as sample C.
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static idleHop = {
    wavUrl: new URL("./idle-hop.wav", import.meta.url).href,
    oggUrl: new URL("./idle-hop.ogg", import.meta.url).href,
  };

  /**
   * Preserve the source credit in production asset output.
   * @type {string}
   */
  static idleHopAttributionUrl = new URL("./idle-hop-attribution.txt", import.meta.url).href;

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
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static scoopPress = {
    wavUrl: new URL("./scoop-press.wav", import.meta.url).href,
    oggUrl: new URL("./scoop-press.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static scoopPull = {
    wavUrl: new URL("./scoop-pull.wav", import.meta.url).href,
    oggUrl: new URL("./scoop-pull.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static scoopTaste = {
    wavUrl: new URL("./scoop-taste.wav", import.meta.url).href,
    oggUrl: new URL("./scoop-taste.ogg", import.meta.url).href,
  };

  /**
   * @returns {{wavUrl:string,oggUrl:string}[]}
   */
  static get sources() {
    return [LatchSlugAudio.jump, LatchSlugAudio.splash, LatchSlugAudio.idleHop, LatchSlugAudio.scoopPress, LatchSlugAudio.scoopPull, LatchSlugAudio.scoopTaste];
  }
}
