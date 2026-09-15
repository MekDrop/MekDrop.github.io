import assert from "node:assert/strict";
import { it } from "node:test";
import { AvcRecordingConfiguration } from "../../src/game/recording/AvcRecordingConfiguration.js";

// Actual encoder output from the Mozilla bug report.
const broken = Uint8Array.from(Buffer.from(
  "0164000d0301001a676764000dac2cac141fa10000030001000003003c0da08845380100056868ce3c30",
  "hex",
));
const corrected = "0164000dffe100196764000dac2cac141fa10000030001000003003c0da088453801000468ce3c30";

it("repairs Firefox duplicated NAL headers and reserved bits before MP4 muxing", () => {
  const metadata = { decoderConfig: { codec: "avc1.64001f", description: broken } };
  AvcRecordingConfiguration.repair(metadata);
  assert.equal(Buffer.from(metadata.decoderConfig.description).toString("hex"), corrected);
  assert.equal(broken[4], 3, "does not mutate the encoder-owned buffer");
});

it("leaves valid AVC and other codec configurations untouched", () => {
  for (const [codec, description] of [["avc1.64001f", Buffer.from(corrected, "hex")], ["vp09.00.40.08", broken]]) {
    const metadata = { decoderConfig: { codec, description } };
    AvcRecordingConfiguration.repair(metadata);
    assert.equal(metadata.decoderConfig.description, description);
  }
  AvcRecordingConfiguration.repair(undefined);
});

it("ignores truncated data and respects buffer view offsets", () => {
  const short = broken.subarray(0, 20);
  const metadata = { decoderConfig: { codec: "avc1.64001f", description: short } };
  AvcRecordingConfiguration.repair(metadata);
  assert.equal(metadata.decoderConfig.description, short);
  const padded = new Uint8Array(broken.length + 4);
  padded.set(broken, 2);
  metadata.decoderConfig.description = padded.subarray(2, 2 + broken.length);
  AvcRecordingConfiguration.repair(metadata);
  assert.equal(Buffer.from(metadata.decoderConfig.description).toString("hex"), corrected);
});
