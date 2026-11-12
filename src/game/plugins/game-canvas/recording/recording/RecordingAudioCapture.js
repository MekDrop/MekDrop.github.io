import { RecordingAudioUnavailableError } from "../../../../errors/recording/index.js";

/**
 * Capture audio on the browser's media pipeline, independently of frame work.
 */
export class RecordingAudioCapture {
  /**
   * @type {MediaRecorder}
   */
  #recorder;
  /**
   * @type {Blob[]}
   */
  #chunks = [];
  /**
   * @type {Promise<Blob>}
   */
  #finished;

  /**
   * @param {MediaStream} stream
   */
  constructor(stream) {
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      .find(/**
       *
       * @param {string} type
       */
        (type) => MediaRecorder.isTypeSupported(type));
    this.#recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.#finished = new Promise(/**
     *
     * @param {(blob: Blob) => void} resolve
     * @param {(error: Error) => void} reject
     */
      (resolve, reject) => {
        this.#recorder.ondataavailable = /**
                                          * @param {BlobEvent} event
                                          */ (event) => {
            if (event.data.size) {
              this.#chunks.push(event.data);
            }
          };
        this.#recorder.onerror = /**
                                  * @param {Event & {error?: Error}} event
                                  */ (event) => reject(event.error ?? new RecordingAudioUnavailableError());
        this.#recorder.onstop = () => resolve(new Blob(this.#chunks, { type: this.#recorder.mimeType }));
      });
    // Avoid an unhandled rejection if recording fails before it is stopped.
    this.#finished.catch(() => {});
  }

  start() {
    this.#recorder.start();
  }

  async stop() {
    if (this.#recorder.state !== "inactive") {
      this.#recorder.stop();
    }
    return this.#finished;
  }

  destroy() {
    if (this.#recorder.state !== "inactive") {
      this.#recorder.stop();
    }
  }
}
