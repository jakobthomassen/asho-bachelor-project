import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const OUT_DIR = "screenshots";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Keep polling until server is available.
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const dev = spawn("npm", ["run", "dev", "--", "--host", HOST, "--port", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  try {
    await waitForServer(`${BASE_URL}/welcome`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/welcome`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT_DIR}/welcome.png`, fullPage: true });

    await page.goto(`${BASE_URL}/login?mode=register`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT_DIR}/opprett-konto.png`, fullPage: true });

    await browser.close();
  } finally {
    if (!dev.killed) {
      dev.kill("SIGTERM");
      await sleep(500);
      if (!dev.killed) dev.kill("SIGKILL");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
