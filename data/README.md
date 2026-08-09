# Canonical dataset

`schools.json` and `districts.json` are the single source of truth for both
the npm and PyPI packages. `scripts/sync-data.mjs` copies these into each
package's source tree at build time — never edit the copies under
`packages/*/`, only these files.

**Currently empty.** The ~3,500-school seed dataset migrated from BrainUs's
internal database is held back until the data license is decided — the
existing rows don't record whether they came from a government PDF or from
Wikipedia, and Wikipedia content is CC-BY-SA (share-alike/attribution
required), so the two sources can't be published under one blanket license
without that attribution. See `LICENSE-DATA`.

## Schema

### `districts.json`

| field      | type   | notes                          |
|------------|--------|---------------------------------|
| `id`       | string | stable identifier               |
| `name`     | string | e.g. "Jaffna"                    |
| `province` | string | e.g. "Northern"                  |

### `schools.json`

| field           | type            | notes                                                       |
|-----------------|-----------------|--------------------------------------------------------------|
| `id`            | string          | stable identifier                                             |
| `name`          | string          |                                                                |
| `districtId`    | string          | FK into `districts.json`                                      |
| `district`      | string          | denormalized for convenience                                  |
| `province`      | string          | denormalized for convenience                                  |
| `type`          | string \| null  | `provincial` \| `national` \| `international` \| `private`    |
| `totalStudents` | number \| null  | enrollment, where known                                       |
| `logoUrl`       | string \| null  | link to school/Wikimedia-hosted logo, not rehosted             |
| `source`        | string \| null  | e.g. `"moe-gov-pdf"` or `"wikipedia"` — required for new rows  |

New contributions must set `source`. Rows missing it are treated as
unverified and excluded from release builds once that check is added to CI.
