import tiltedUrl from "../../models/thread-spool/tilted-thread-spool.glb?url";
import smallUrl from "../../models/thread-spool/small-thread-spool.glb?url";
import largeUrl from "../../models/thread-spool/large-thread-spool.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * One original sewing thread spool, independently placeable or contained by a basket.
 */
export class ThreadSpool extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [tiltedUrl, smallUrl, largeUrl]; }

  /**
   * @returns {string}
   */
  get modelUrl() {
    if (this.definition.variant === "tilted") { return tiltedUrl; }
    if (this.definition.variant === "small") { return smallUrl; }
    return largeUrl;
  }
}
