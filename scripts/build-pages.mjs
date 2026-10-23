import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "src", "app", "api");
const excludedDir = path.join(root, "src", "app", "_api_server_excluded");

const env = {
  ...process.env,
  GITHUB_PAGES: "1",
  NEXT_PUBLIC_STATIC_DEMO: "1",
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/moneydolly-campaign-draft",
};

let moved = false;

function restoreApi() {
  if (!moved) return;
  if (fs.existsSync(excludedDir) && !fs.existsSync(apiDir)) {
    fs.renameSync(excludedDir, apiDir);
  } else if (fs.existsSync(excludedDir)) {
    fs.rmSync(excludedDir, { recursive: true, force: true });
  }
  moved = false;
}

try {
  if (fs.existsSync(excludedDir)) {
    fs.rmSync(excludedDir, { recursive: true, force: true });
  }
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, excludedDir);
    moved = true;
  }

  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  restoreApi();
}
