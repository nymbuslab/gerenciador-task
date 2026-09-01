import { spawn } from "node:child_process";

const port = 3100;
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}/`;

const server = spawn("node", ["tests/e2e/server.mjs"], {
  stdio: "inherit",
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.status === 200) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Servidor E2E nao ficou pronto dentro do prazo.");
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
      stdio: "inherit",
      windowsHide: true,
    });

    tests.on("error", reject);
    tests.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Playwright terminou com codigo ${code}.`));
    });
  });
}

async function stopServer() {
  if (server.exitCode !== null) {
    return;
  }

  server.kill("SIGTERM");
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 1_000);
  });
}

try {
  await waitForServer();
  await runPlaywright();
} finally {
  await stopServer();
}
