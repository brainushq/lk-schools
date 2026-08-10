#!/usr/bin/env node
// Invariants the packages' load-time province join and public IDs depend
// on. Run in CI on every push/PR so a bad contributor edit to /data fails
// loudly instead of silently breaking province filtering downstream.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const districts = JSON.parse(
  readFileSync(path.join(repoRoot, "data/districts.json"), "utf-8"),
);
const schools = JSON.parse(
  readFileSync(path.join(repoRoot, "data/schools.json"), "utf-8"),
);

const errors = [];
const districtNames = new Set(districts.map((d) => d.name));

const seenIds = new Set();
for (const school of schools) {
  if (!school.id) errors.push(`school missing id: ${JSON.stringify(school)}`);
  else if (seenIds.has(school.id)) errors.push(`duplicate id: ${school.id}`);
  seenIds.add(school.id);

  if (!districtNames.has(school.district)) {
    errors.push(`school "${school.name}" (${school.id}) has unknown district "${school.district}"`);
  }
}

if (errors.length > 0) {
  console.error(`${errors.length} data validation error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: ${districts.length} districts, ${schools.length} schools, all district references valid, all ids unique.`);
