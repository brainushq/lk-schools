# lk-schools

An open, community-maintained list of Sri Lankan schools — published as an
npm package and a PyPI package, both generated from one canonical dataset in
this repo.

## Status

Early scaffold. Not yet published. Current seed data (being migrated from an
internal BrainUs dataset) covers ~3,500 schools with uneven coverage across
districts — see `data/README.md` once added.

## Structure

```text
data/                 canonical dataset (single source of truth)
packages/npm/         npm package — reads data/ at build time
packages/pypi/        PyPI package — reads data/ at build time
.github/workflows/    CI: validate data, build + publish both packages
```

## License

Code: MIT (see `LICENSE`).
Data: CC-BY-SA 4.0 (see `LICENSE-DATA`) — the dataset is derived in part
from Wikipedia, so the whole dataset carries Wikipedia's share-alike and
attribution terms even though not every row originated there.

## Contributing

Fixes and additions to `data/` are welcome via pull request. New rows must
set a `source` field (e.g. `"moe-gov-pdf"` or `"wikipedia"`) — see
`data/README.md` for the schema.
