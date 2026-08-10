# lk-schools

[![npm](https://img.shields.io/npm/v/@brainus/lk-schools?style=flat-square&label=npm)](https://www.npmjs.com/package/@brainus/lk-schools)
[![PyPI](https://img.shields.io/pypi/v/lk-schools?style=flat-square&label=PyPI)](https://pypi.org/project/lk-schools/)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/3Y7KsR7qcW)

An open, community-maintained dataset of **every government school in Sri
Lanka**: 10,076 schools from the Ministry of Education's official 2024
lists, published as an npm package and a PyPI package, both generated from
one canonical dataset in this repo.

Each school comes with its official MoE census number, address, education
zone and division, and A/L grade-span classification (`moeType`), useful
for anything from school directories to A/L-focused products.

## Install

```bash
npm install @brainus/lk-schools        # JavaScript / TypeScript
```

```bash
pip install lk-schools                # Python
```

(Registry names differ: `@brainus/lk-schools` on npm to match BrainUs's
existing `@brainus/*` packages, `lk-schools` on PyPI since that name was
free.)

## Quick start

```js
import { findSchools, getSchoolById, getProvinces } from "@brainus/lk-schools";

const alSchools = findSchools({ province: "Western", type: "national" });
const royal = getSchoolById("colombo-royal-college-colombo");
const provinces = getProvinces();
```

```python
from lk_schools import find_schools, get_school_by_id, get_provinces

al_schools = find_schools(province="Western", type="national")
royal = get_school_by_id("colombo-royal-college-colombo")
provinces = get_provinces()
```

Every school is filterable by `district`, `province`, and `type`
(`national` | `provincial` | `private` | `international`), or by a
case-insensitive name `query`.

## The dataset

| | |
|---|---|
| Schools | **10,076 government** (396 national + 9,680 provincial) + 7 private |
| Districts | 25 (all of Sri Lanka) |
| Provinces | 9 |
| Source | Ministry of Education, Educational Statistics 2024: [dmb.moe.gov.lk/showStat2024.php](https://dmb.moe.gov.lk/showStat2024.php) |

Fields per school: `id`, `name`, `district`, `type`, `censusNo`,
`moeType`, `address`, `zone`, `educationDivision`, `source`.

`moeType` is the MoE grade-span classification: `1AB` and `1C` schools
offer G.C.E. A/L, `Type2` goes to O/L, `Type3` is primary-only. Full
schema and the moeType table: [`data/README.md`](data/README.md).

## Contributing

Fixes and additions to `data/` are welcome via pull request. New rows must
set a `source` field (e.g. `"moe-gov-2024"` or `"wikipedia"`), see
[`data/README.md`](data/README.md) for the schema. The dataset is rebuilt
from the official MoE lists with `scripts/build-from-moe.py`.

## Community

Join the [BrainUs Discord](https://discord.gg/3Y7KsR7qcW), ask questions,
share what you're building, and get help from the team.

## License

Code: MIT (see `LICENSE`).
Data: CC-BY-SA 4.0 (see `LICENSE-DATA`), the dataset is derived from the
Ministry of Education's official 2024 school lists.

---

Made with ❤️ by the BrainUs team
