# Canonical dataset

`schools.json` and `districts.json` are the single source of truth for both
the npm and PyPI packages. `scripts/sync-data.mjs` copies these into each
package's source tree at build time — never edit the copies under
`packages/*/`, only these files.

**Currently empty.** The ~3,500-school seed dataset migrated from BrainUs's
internal database is not yet loaded here — migration is the next step. The
dataset is licensed CC-BY-SA 4.0 (see `LICENSE-DATA`) as a blanket policy
since existing rows don't record per-row source.

## Schema

### `districts.json`

| field      | type   | notes                                     |
|------------|--------|--------------------------------------------|
| `name`     | string | e.g. "Jaffna" — the district's own key, no separate id |
| `province` | string | e.g. "Northern"                            |

### `schools.json`

| field           | type            | notes                                                                 |
|-----------------|-----------------|-------------------------------------------------------------------------|
| `id`            | string          | slug owned by this dataset, e.g. `"trinity-college-kandy"` — not a database ID, contributors mint their own |
| `name`          | string          |                                                                          |
| `district`      | string          | matches a `name` in `districts.json`                                    |
| `province`      | string          | denormalized for convenience                                            |
| `type`          | string \| null  | `provincial` \| `national` \| `international` \| `private`              |
| `totalStudents` | number \| null  | enrollment, where known                                                 |
| `logoUrl`       | string \| null  | link to school/Wikimedia-hosted logo, not rehosted                       |
| `source`        | string \| null  | e.g. `"moe-gov-pdf"` or `"wikipedia"` — required for new rows            |

New contributions must set `source`. Rows missing it are treated as
unverified and excluded from release builds once that check is added to CI.
