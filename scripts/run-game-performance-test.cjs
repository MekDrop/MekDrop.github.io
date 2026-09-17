const { spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const serverUrl = "http://127.0.0.1:9000";
const isWindows = process.platform === "win32";
const quasarCli = path.join(
  projectRoot,
  "node_modules",
  "@quasar",
  "app-vite",
  "bin",
  "quasar",
);
const cypressCli = path.join(
  projectRoot,
  "node_modules",
  "cypress",
  "bin",
  "cypress",
);

let serverProcess = null;

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function serverIsReady() {
  try {
    const response = await fetch(serverUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return true;
    if (serverProcess?.exitCode !== null) return false;
    await delay(250);
  }
  return false;
}

function runNodeCli(cliPath, argumentsList, options = {}) {
  return spawn(process.execPath, [cliPath, ...argumentsList], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
}

function waitForExit(childProcess) {
  return new Promise((resolve) => {
    childProcess.once("error", () => resolve(1));
    childProcess.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;

  if (isWindows) {
    const taskkill = spawn(
      "taskkill.exe",
      ["/pid", String(serverProcess.pid), "/t", "/f"],
      { stdio: "ignore", windowsHide: true },
    );
    await waitForExit(taskkill);
    return;
  }

  try {
    process.kill(-serverProcess.pid, "SIGTERM");
  } catch {
    serverProcess.kill("SIGTERM");
  }
}

async function main() {
  const reusedServer = await serverIsReady();

  if (!reusedServer) {
    serverProcess = runNodeCli(quasarCli, ["dev"], { detached: true });
    const ready = await waitForServer(60000);
    if (!ready) {
      console.error(`Game test server did not become ready at ${serverUrl}.`);
      await stopServer();
      process.exitCode = 1;
      return;
    }
  }

  const cypressProcess = runNodeCli(cypressCli, [
    "run",
    "--e2e",
    "--browser",
    "electron",
    "--config-file",
    "cypress.performance.config.cjs",
  ]);
  const exitCode = await waitForExit(cypressProcess);

  if (!reusedServer) await stopServer();
  process.exitCode = exitCode;
}

process.once("SIGINT", async () => {
  await stopServer();
  process.exit(130);
});
process.once("SIGTERM", async () => {
  await stopServer();
  process.exit(143);
});

main();
