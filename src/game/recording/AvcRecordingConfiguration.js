/** Repairs the specific malformed AVCC header from Mozilla bug 2031056.
 * https://bugzilla.mozilla.org/show_bug.cgi?id=2031056
 */
export class AvcRecordingConfiguration {
  static repair(metadata) {
    const config = metadata?.decoderConfig;
    if (!config?.codec?.startsWith("avc1") || !config.description) {
      return;
    }
    const description = config.description;
    const bytes = ArrayBuffer.isView(description)
      ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
      : new Uint8Array(description);
    // Match only the broken single-SPS/single-PPS signature. Leave valid or
    // unfamiliar configurations untouched, including future Firefox encoders.
    if (bytes.length < 15 || bytes[0] !== 1 || bytes[4] !== 3 || bytes[5] !== 1 ||
      bytes[8] !== 0x67 || bytes[9] !== 0x67 || bytes[10] !== bytes[1]) {
      return;
    }
    const spsLength = bytes[6] * 256 + bytes[7];
    const ppsCount = 8 + spsLength;
    const ppsStart = ppsCount + 3;
    if (spsLength < 4 || ppsStart + 2 > bytes.length || bytes[ppsCount] !== 1 ||
      bytes[ppsStart] !== 0x68 || bytes[ppsStart + 1] !== 0x68) {
      return;
    }
    const ppsLength = bytes[ppsCount + 1] * 256 + bytes[ppsCount + 2];
    if (ppsLength < 2 || ppsStart + ppsLength > bytes.length) {
      return;
    }
    const repaired = new Uint8Array(bytes.length - 2);
    repaired.set(bytes.subarray(0, 8));
    repaired.set(bytes.subarray(9, ppsStart), 8);
    repaired.set(bytes.subarray(ppsStart + 1), ppsStart - 1);
    repaired[4] = 0xff;
    repaired[5] = 0xe1;
    repaired[6] = (spsLength - 1) >> 8;
    repaired[7] = (spsLength - 1) & 0xff;
    repaired[ppsCount] = (ppsLength - 1) >> 8;
    repaired[ppsCount + 1] = (ppsLength - 1) & 0xff;
    config.description = repaired;
  }
}
