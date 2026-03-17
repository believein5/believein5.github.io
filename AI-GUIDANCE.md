# AI Guidance (for coding agents)

This file is a compact guidance document for AI agents that modify this project.

## Project intent

- This repository is a static personal knowledge graph site.
- The graph pipeline is now **DB-first**.
- `db/schema.sql` + `db/graph.db` are the primary data processing center.
- `graph/source.json` is a migration-stage editable input, not the final runtime source.

## Critical workflow

1. (Optional migration input) Edit `graph/source.json` and `graph/relation-types.json`.
2. Run `tools/source-to-db-sql.mjs` to refresh `db/import-source.sql`.
3. Run `tools/pdf-bookshelf-to-db.py --db db/graph.db --bookshelf BookShelf --migrate-source`.
4. Run `tools/db-to-graph.py --db db/graph.db --out graph/knowledge-graph.json`.
5. Verify graph page behavior in both modes:
   - Book Hierarchy
   - Knowledge Network

## Do not break these constraints

- Provenance links (`defined_in`, `cite_from`, `support`) are tooltip/detail info; do **not** render them as standalone graph nodes.
- Prefer `taxonomyDomain` for discipline classification in graph UI; fallback to `discipline`.
- Keep bilingual support intact (`zh` / `en`) for UI labels and data fields (`*I18n`).

## Manual tuning interface

The graph page includes a tuning panel and reads persistent defaults from:

- `graph/tuning-config.json`

Key tuning fields:

- `nodeSizeScale`
- `degreeGain`
- `edgeWidthScale`
- `levelSeparation`
- `nodeSpacing`
- `physicsIterations`

## Recommended change strategy

- Make small, reversible edits.
- Avoid changing generated file by hand unless debugging.
- Update documentation when schema/controls change.
