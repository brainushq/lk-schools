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
Data: TBD — the dataset is derived from Sri Lankan government PDFs and
Wikipedia, which may require share-alike/attribution terms (e.g. CC-BY-SA or
ODbL). A `LICENSE-DATA` file and a per-row `source` field will be added
before any data is published.

## Contributing

Fixes and additions to `data/` are welcome via pull request once the data
schema and licensing are finalized.
