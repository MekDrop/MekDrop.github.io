import assert from "node:assert/strict";
import { it } from "node:test";
import { RecordingAudioCapture } from "../../../../../../../src/game/plugins/game-canvas/recording/recording/RecordingAudioCapture.js";

it("collects independently recorded audio until stop and preserves its format", async () => {
  const original = globalThis.MediaRecorder;
  class FakeRecorder {
    static isTypeSupported(type) {
      return type === "audio/webm;codecs=opus";
    }
    constructor(stream, options) {
      this.stream = stream; this.mimeType = options.mimeType; this.state = "inactive";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob(["first"]) });
      this.ondataavailable({ data: new Blob(["second"]) });
      this.onstop();
    }
  }
  globalThis.MediaRecorder = FakeRecorder;
  try {
    const capture = new RecordingAudioCapture({});
    capture.start();
    const blob = await capture.stop();
    assert.equal(blob.type, "audio/webm;codecs=opus");
    assert.equal(await blob.text(), "firstsecond");
    capture.destroy();
  } finally {
    globalThis.MediaRecorder = original;
  }
});
