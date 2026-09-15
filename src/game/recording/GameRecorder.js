import { GAME_RECORDING_STATE } from "../enum/GameRecordingState.js";
import { RecordingVideoEncoderUnavailableError } from "../errors/recording/index.js";
import { RecordingCanvas } from "./RecordingCanvas.js";
import { RecordingAudio } from "./RecordingAudio.js";
import { AvcRecordingConfiguration } from "./AvcRecordingConfiguration.js";

/** Local MP4 recording. Encoder packages are loaded only when recording starts. */
export class GameRecorder {
  #app;
  #canvas;
  #onStateChange;
  #onError;
  #state = GAME_RECORDING_STATE.IDLE;
  #session = null;
  #destroyed = false;

  constructor({ app, canvas, onStateChange, onError }) {
    this.#app = app;
    this.#canvas = canvas;
    this.#onStateChange = onStateChange;
    this.#onError = onError;
    document.addEventListener("visibilitychange", this.#visibilityChange);
  }

  async toggle() {
    if (this.#destroyed) {
      return;
    }
    if (this.#state === GAME_RECORDING_STATE.IDLE) {
      await this.#start();
    } else if (this.#state === GAME_RECORDING_STATE.RECORDING) {
      await this.#stop();
    }
  }

  #setState(state) {
    this.#state = state;
    this.#onStateChange?.(state);
  }

  async #start() {
    this.#setState(GAME_RECORDING_STATE.STARTING);
    const session = { output: null, compositor: null, audio: null, stream: null };
    this.#session = session;
    try {
      // Resume game audio within the shortcut's user activation, before imports.
      session.audio = new RecordingAudio(this.#app);
      const resumed = session.audio.resume();
      const [media] = await Promise.all([import("mediabunny"), resumed]);
      if (this.#destroyed) {
        return;
      }
      session.compositor = new RecordingCanvas(this.#canvas);
      const { width, height } = session.compositor.canvas;
      const frameRate = 60;
      // Preserve fine grass/model detail, with more bits for larger canvases.
      const bitrate = Math.round(Math.max(30_000_000, width * height * frameRate * 0.25));
      const codec = await media.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], {
        width, height, bitrate,
      });
      if (!codec) {
        throw new RecordingVideoEncoderUnavailableError();
      }
      // Prefer consistent detail over a fixed file size, with a generous
      // bitrate fallback for encoders without constant-quality support.
      const quality = new media.Quality({
        quantizer: codec === "avc" ? 18 : codec === "vp9" ? 20 : 80,
        bitrate,
      });
      if (!(await media.canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 }))) {
        const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
        registerAacEncoder();
      }
      if (this.#destroyed) {
        return;
      }
      session.target = new media.BufferTarget();
      session.output = new media.Output({
        format: new media.Mp4OutputFormat({ fastStart: "in-memory" }),
        target: session.target,
      });
      session.compositor.draw();
      session.stream = session.compositor.canvas.captureStream(frameRate);
      session.videoSource = new media.MediaStreamVideoTrackSource(
        session.stream.getVideoTracks()[0],
        {
          codec, quality, latencyMode: "quality", keyFrameInterval: 2,
          onEncodedPacket: (_packet, metadata) => AvcRecordingConfiguration.repair(metadata),
        },
        { frameRate },
      );
      session.audioSource = new media.MediaStreamAudioTrackSource(
        session.audio.stream.getAudioTracks()[0],
        { codec: "aac", bitrate: 128_000, transform: { numberOfChannels: 2, sampleRate: 48000 } },
      );
      session.output.addVideoTrack(session.videoSource, { frameRate });
      session.output.addAudioTrack(session.audioSource);
      session.videoSource.errorPromise.catch((error) => this.#fail(session, error));
      session.audioSource.errorPromise.catch((error) => this.#fail(session, error));
      await session.output.start();
      if (this.#destroyed || this.#session !== session) {
        return;
      }
      session.frameHandle = this.#app.on("frameend", () => {
        try {
          session.compositor.draw();
          session.audio.sync();
        } catch (error) {
          void this.#fail(session, error);
        }
      });
      this.#setState(GAME_RECORDING_STATE.RECORDING);
    } catch (error) {
      await this.#release(session, true);
      throw error;
    } finally {
      if (this.#destroyed) {
        await this.#release(session, true);
      }
    }
  }

  async #stop() {
    const session = this.#session;
    this.#setState(GAME_RECORDING_STATE.STOPPING);
    session.frameHandle?.off();
    try {
      await session.output.finalize();
      if (!this.#destroyed) {
        const blob = new Blob([session.target.buffer], { type: "video/mp4" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `game-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } finally {
      await this.#release(session, session.output.state !== "finalized");
    }
  }

  async #fail(session, error) {
    if (this.#session !== session || this.#state === GAME_RECORDING_STATE.STOPPING) {
      return;
    }
    this.#setState(GAME_RECORDING_STATE.STOPPING);
    await this.#release(session, true);
    if (!this.#destroyed) {
      this.#onError?.(error);
    }
  }

  async #release(session, cancel) {
    session.frameHandle?.off();
    if (this.#session === session) {
      this.#session = null;
      this.#setState(GAME_RECORDING_STATE.IDLE);
    }
    // Disconnect synchronously while the PlayCanvas audio context still exists.
    if (!session.released) {
      session.released = true;
      for (const track of session.stream?.getTracks() ?? []) {
        track.stop();
      }
      session.audio?.destroy();
      session.compositor?.destroy();
    }
    if (cancel) {
      await session.output?.cancel().catch(() => {});
    }
  }

  #visibilityChange = () => {
    // Save when backgrounded; browsers throttle hidden canvases and their clocks.
    if (document.hidden && this.#state === GAME_RECORDING_STATE.RECORDING) {
      void this.#stop().catch(this.#onError);
    }
  };

  destroy() {
    this.#destroyed = true;
    document.removeEventListener("visibilitychange", this.#visibilityChange);
    if (this.#session) {
      void this.#release(this.#session, true);
    }
  }
}
