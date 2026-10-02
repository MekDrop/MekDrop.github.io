import cliProgress from "cli-progress";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { CastleGenerator } from "../src/game/generator/castle/CastleGenerator.js";
import { TerrainBlockDefinitions } from "../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { CastleMapPreparation } from "../src/game/objects/castle/CastleMapPreparation.js";
import { validateCastleGround } from "../src/game/objects/castle/CastleGroundValidation.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run check:castle-ground -- [--json] [map.json | directory ...]\nDefaults to src/game/maps. Checks runtime-prepared saved JSON maps without modifying files.\nExit 0: clean; exit 1: collisions; exit 2: invalid/unreadable map or argument.");
} else {
  const json = args.includes("--json");
  const inputs = args.filter((arg) => arg !== "--json");
  const report = { maps: 0, castles: 0, skipped: 0, issues: [], errors: [] };
  const files = new Set();
  /**
   * @param {string} path
   */
  async function discover(path) {
    if (path.endsWith(".json")) { files.add(resolve(path)); return; }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) await discover(child);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.add(child);
    }
  }
  for (const input of inputs.length ? inputs : ["src/game/maps"]) {
    try { await discover(input); }
    catch (error) { report.errors.push({ map: input, message: error.message }); }
  }
  const sortedFiles = [...files].sort();
  const progressBar = json ? null : new cliProgress.SingleBar({
    format: "[{bar}] {percentage}% ({value}/{total} maps) | {castles} castles, {skipped} skipped | {map}",
    barCompleteChar: "#",
    barIncompleteChar: "-",
    barsize: 20,
    noTTYOutput: true,
    notTTYSchedule: 10000,
    stream: process.stderr,
    forceRedraw: true,
  });
  let completed = 0;
  if (sortedFiles.length) progressBar?.start(sortedFiles.length, 0, { castles: 0, skipped: 0, map: "Starting" });
  for (const file of sortedFiles) {
    const map = relative(process.cwd(), file);
    progressBar?.update(completed, { castles: report.castles, skipped: report.skipped, map });
    progressBar?.render();
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      const castles = (data.objects ?? []).filter((object) => object.object === "Castle");
      if (!castles.length) { report.skipped += 1; continue; }
      report.maps += 1;
      report.castles += castles.length;
      // Match per-castle seed rebuilding performed by the saved-map loader.
      for (const castle of castles) {
        
        castle.buildPlan = await CastleGenerator.generate({
          position: castle.position ?? castle.buildPlan?.input?.position,
          doors: castle.doors ?? castle.buildPlan?.input?.doors,
          style: castle.style ?? castle.buildPlan?.input?.requestedStyle,
          seed: castle.seed ?? castle.buildPlan?.input?.seed,
        });
      }
      TerrainBlockDefinitions.populate(data);
      CastleMapPreparation.prepareMap(data);
      report.issues.push(...validateCastleGround(data).map((issue) => ({ map, ...issue })));
    } catch (error) { report.errors.push({ map, message: error.message }); }
    finally {
      completed += 1;
      progressBar?.update(completed, { castles: report.castles, skipped: report.skipped, map });
      progressBar?.render();
    }
  }
  progressBar?.stop();
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    const groups = new Map();
    for (const issue of report.issues) {
      const family = issue.area.split(":")[0];
      const key = `${issue.map}:${issue.castleId}:${issue.kind}:${family}`;
      const group = groups.get(key) ?? { issue, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    for (const { issue, count } of groups.values()) {
      const point = [issue.position.x, issue.position.y, issue.position.z].map((value) => Number(value.toFixed(3))).join(", ");
      console.log(`FAIL ${issue.map}: castle ${issue.castleId}, seed ${issue.seed ?? "unseeded"}, ${issue.area.split(":")[0]}, ${count} ${issue.certainty === "potential" ? "potential " : ""}${issue.kind.replace("-potential", "")} overlaps; example ${issue.terrainId ?? ""} at (${point})`);
    }
    for (const error of report.errors) console.error(`ERROR ${error.map}: ${error.message}`);
    const potential = report.issues.filter((issue) => issue.certainty === "potential").length;
    console.log(`Checked ${report.castles} castles in ${report.maps} saved maps: ${report.issues.length - potential} confirmed ground collisions, ${potential} potential canopy overlaps, ${report.errors.length} errors. Skipped ${report.skipped} maps without castles.`);
  }
  process.exitCode = report.errors.length ? 2 : report.issues.length ? 1 : 0;
}
