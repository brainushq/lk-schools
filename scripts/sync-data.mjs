#!/usr/bin/env node
// Copies the canonical dataset in /data into a package's source tree
// before build. The copies are generated, not committed — each package
// stays in sync with /data automatically at build time.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const dataDir = path.join(repoRoot, "data");
const dataFiles = ["schools.json", "districts.json"];

const targets = {
  npm: path.join(repoRoot, "packages/npm/src/data"),
  pypi: path.join(repoRoot, "packages/pypi/lk_schools/data"),
  api: path.join(repoRoot, "packages/api/src/data"),
  // Served as static files by the API Worker.
  "api-assets": path.join(repoRoot, "packages/api/public/v1"),
};

const names = process.argv.slice(2);
if (names.length === 0 || names.some((t) => !(t in targets))) {
  console.error(`Usage: sync-data.mjs <${Object.keys(targets).join("|")}>...`);
  process.exit(1);
}

for (const name of names) {
  const dest = targets[name];
  mkdirSync(dest, { recursive: true });
  for (const file of dataFiles) {
    copyFileSync(path.join(dataDir, file), path.join(dest, file));
  }
  console.log(`Synced ${dataFiles.join(", ")} -> ${dest}`);
}
