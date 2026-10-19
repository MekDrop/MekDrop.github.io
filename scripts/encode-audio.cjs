const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Keep WAV masters; Vorbis's managed 192 kbps mode requires a full-rate input.
const temporaryDirectory = path.resolve("tmp/audio-encoding");
fs.mkdirSync(temporaryDirectory, { recursive: true });
for (const source of fs.globSync("src/game/audio/**/*.wav")) {
  const output = source.slice(0, -4) + ".ogg";
  const temporaryOutput = path.join(temporaryDirectory, `${path.basename(source, ".wav")}-${process.pid}.ogg`);
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-vn", "-ar", "48000", "-c:a", "libvorbis", "-b:a", "192k", temporaryOutput,
  ], { stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) {
    fs.rmSync(temporaryOutput, { force: true });
    console.error(`Unable to encode ${source}: ${result.error?.message ?? result.status}`);
    process.exitCode = 1;
    break;
  }
  fs.renameSync(temporaryOutput, output);
  console.log(`Encoded ${path.basename(output)} (Vorbis, nominal 192 kbps)`);
}
