# AI Guidance (for coding agents)

This file is a compact guidance document for AI agents that modify this project.

## Project intent

- This repository is a static personal knowledge graph site.
- The graph pipeline is **source-first**.
- `graph/source.json` is the single source of truth for hierarchy + knowledge relations.

## Critical workflow

1. Edit `graph/source.json` and (if needed) `graph/relation-types.json`.
2. Run `tools/source-to-graph.mjs` to regenerate `graph/knowledge-graph.json`.
3. Verify graph page behavior in both modes:
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
