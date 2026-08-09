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
};

const target = process.argv[2];
if (!target || !(target in targets)) {
  console.error(`Usage: sync-data.mjs <${Object.keys(targets).join("|")}>`);
  process.exit(1);
}

const dest = targets[target];
mkdirSync(dest, { recursive: true });
for (const file of dataFiles) {
  copyFileSync(path.join(dataDir, file), path.join(dest, file));
}
console.log(`Synced ${dataFiles.join(", ")} -> ${dest}`);
