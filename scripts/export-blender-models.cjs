const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cliProgress = require("cli-progress");

const projectRoot = path.resolve(__dirname, "..");
const modelsRoot = path.join(projectRoot, "src", "game", "models");
const sourceSizeKey = "sourceBlendSizeBytes";
const jsonChunkType = 0x4e4f534a; // "JSON" in little-endian GLB
const exportExpression = [
  "import bpy, os",
  "source_size = int(os.environ['BLENDER_SOURCE_SIZE'])",
  `[scene.__setitem__('${sourceSizeKey}', source_size) for scene in bpy.data.scenes]`,
  "result = bpy.ops.export_scene.gltf(filepath=os.environ['BLENDER_EXPORT_OUTPUT'], export_format='GLB', export_extras=True)",
  "assert 'FINISHED' in result, result",
].join("; ");

class BlenderExportError extends Error {}

function findModels(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findModels(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".blend") ? [entryPath] : [];
    })
    .sort();
}

function findBlender() {
  if (process.env.BLENDER_BIN) {
    return process.env.BLENDER_BIN;
  }

  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
    ].filter(Boolean);
    const installations = roots.flatMap((root) => {
      const folder = path.join(root, "Blender Foundation");
      if (!fs.existsSync(folder)) {
        return [];
      }
      return fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(folder, entry.name, "blender.exe"))
        .filter((candidate) => fs.existsSync(candidate));
    });
    installations.sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    );
    if (installations.length > 0) {
      return installations[0];
    }
  }

  if (process.platform === "darwin") {
    const appBlender = "/Applications/Blender.app/Contents/MacOS/Blender";
    if (fs.existsSync(appBlender)) {
      return appBlender;
    }
  }

  return "blender";
}

function getWorkerCount(modelCount) {
  const configured = process.env.BLENDER_EXPORT_JOBS;
  if (configured !== undefined) {
    const count = Number(configured);
    if (!/^[1-9]\d*$/.test(configured) || !Number.isSafeInteger(count)) {
      throw new BlenderExportError("BLENDER_EXPORT_JOBS must be a positive integer");
    }
    return Math.min(modelCount, count);
  }
  return Math.min(modelCount, Math.max(1, Math.floor(os.availableParallelism() / 2)));
}

function getSourceSizeFromGlb(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const glb = fs.readFileSync(filePath);
    if (
      glb.length < 20 ||
      glb.toString("ascii", 0, 4) !== "glTF" ||
      glb.readUInt32LE(4) !== 2 ||
      glb.readUInt32LE(8) !== glb.length ||
      glb.readUInt32LE(16) !== jsonChunkType
    ) {
      return null;
    }
    const jsonLength = glb.readUInt32LE(12);
    if (jsonLength === 0 || jsonLength % 4 !== 0 || 20 + jsonLength > glb.length) {
      return null;
    }
    const gltf = JSON.parse(glb.toString("utf8", 20, 20 + jsonLength));
    const sourceSize = gltf.scenes?.[gltf.scene ?? 0]?.extras?.[sourceSizeKey];
    return Number.isSafeInteger(sourceSize) && sourceSize >= 0
      ? sourceSize
      : null;
  } catch {
    return null;
  }
}

async function exportModel(model, blender, sourceSize) {
  const output = model.slice(0, -".blend".length) + ".glb";
  const temporaryOutput = path.join(
    path.dirname(output),
    `.${path.basename(output, ".glb")}.${process.pid}.exporting.glb`,
  );
  const logPath = `${temporaryOutput}.log`;
  fs.rmSync(temporaryOutput, { force: true });
  fs.rmSync(logPath, { force: true });

  try {
    const logFd = fs.openSync(logPath, "w");
    let child;
    try {
      child = spawn(
        blender,
        [
          "--background",
          model,
          "--python-exit-code",
          "1",
          "--python-expr",
          exportExpression,
        ],
        {
          stdio: ["ignore", logFd, logFd],
          windowsHide: true,
          env: {
            ...process.env,
            BLENDER_EXPORT_OUTPUT: temporaryOutput,
            BLENDER_SOURCE_SIZE: String(sourceSize),
          },
        },
      );
    } finally {
      fs.closeSync(logFd);
    }

    await new Promise((resolve, reject) => {
      let processError = null;
      child.once("error", (error) => {
        processError = error;
      });
      child.once("close", (status, signal) => {
        if (processError) {
          reject(processError);
        } else if (status !== 0) {
          reject(new BlenderExportError(`Blender exited with ${signal ? `signal ${signal}` : `status ${status}`}`));
        } else {
          resolve();
        }
      });
    });

    if (
      !fs.existsSync(temporaryOutput) ||
      fs.statSync(temporaryOutput).size === 0
    ) {
      throw new BlenderExportError("Blender did not produce a nonempty GLB file");
    }
    if (getSourceSizeFromGlb(temporaryOutput) !== sourceSize) {
      throw new BlenderExportError("Blender did not embed the source size in the GLB");
    }
    fs.renameSync(temporaryOutput, output);
    return fs.readFileSync(logPath, "utf8").trim();
  } catch (error) {
    const blenderOutput = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim()
      : "";
    throw new BlenderExportError(
      `${path.relative(projectRoot, model)}: ${error.message}${blenderOutput ? `\n${blenderOutput}` : ""}`,
    );
  } finally {
    fs.rmSync(temporaryOutput, { force: true });
    fs.rmSync(logPath, { force: true });
  }
}

async function main() {
  const options = process.argv.slice(2);
  const unknownOption = options.find(
    (option) => option !== "--verbose" && option !== "-v" && option !== "--force",
  );
  if (unknownOption) {
    throw new BlenderExportError(`Unknown option: ${unknownOption}`);
  }
  const force = options.includes("--force");
  const npmLogLevel = process.env.npm_config_loglevel?.toLowerCase();
  const verbose =
    options.includes("--verbose") ||
    options.includes("-v") ||
    npmLogLevel === "verbose" ||
    npmLogLevel === "silly";
  const models = findModels(modelsRoot);
  if (models.length === 0) {
    throw new BlenderExportError("No .blend files found under src/game/models");
  }

  const blender = findBlender();
  const workerCount = getWorkerCount(models.length);
  const progressBar = new cliProgress.SingleBar({
    format: "[{bar}] {percentage}% ({value}/{total}) | {exported} exported, {skipped} skipped",
    barCompleteChar: "#",
    barIncompleteChar: "-",
    barsize: 20,
    noTTYOutput: true,
    notTTYSchedule: 10000,
    stream: process.stdout,
    forceRedraw: true,
  });
  let nextIndex = 0;
  let completed = 0;
  let exported = 0;
  let skipped = 0;
  let firstError = null;
  progressBar.start(models.length, 0, { exported, skipped });

  async function worker() {
    while (nextIndex < models.length && !firstError) {
      const model = models[nextIndex];
      nextIndex += 1;
      const modelName = path.relative(projectRoot, model);
      try {
        const sourceSize = fs.statSync(model).size;
        const output = model.slice(0, -".blend".length) + ".glb";
        if (!force && getSourceSizeFromGlb(output) === sourceSize) {
          skipped += 1;
          if (verbose) {
            console.log(`Skipping ${modelName}: source size matches`);
          }
        } else {
          if (verbose) {
            console.log(`Exporting ${modelName}...`);
          }
          const blenderOutput = await exportModel(model, blender, sourceSize);
          exported += 1;
          if (verbose && blenderOutput) {
            console.log(`Blender output for ${modelName}:\n${blenderOutput}`);
          }
        }
        completed += 1;
        progressBar.update(completed, { exported, skipped });
        if (!process.stdout.isTTY && completed < models.length) {
          progressBar.render();
        }
      } catch (error) {
        if (!firstError) {
          firstError = error;
        }
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (firstError) {
      throw firstError;
    }
  } finally {
    progressBar.stop();
  }
}

main().catch((error) => {
  console.error(`Blender export failed: ${error.message}`);
  process.exitCode = 1;
});
