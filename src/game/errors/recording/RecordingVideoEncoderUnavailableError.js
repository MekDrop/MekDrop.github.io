export class RecordingVideoEncoderUnavailableError extends Error {
  constructor() {
    super("This browser cannot encode video for an MP4 recording.");
    this.name = "RecordingVideoEncoderUnavailableError";
  }
}
