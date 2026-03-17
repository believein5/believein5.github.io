# Graph directory

This folder now provides graph snapshots consumed by the frontend with two graph views:

- **Book Graph**: `Book -> Chapter -> Section -> Knowledge`
- **Knowledge Graph**: knowledge nodes linked by semantic relations (no source nodes shown)

> Current project phase is migrating to **DB-first**. `knowledge-graph.json` can now be generated from DB using `tools/db-to-graph.py`.

## Core files

- `source.json`: canonical source tree (`books/chapters/sections/knowledge`) and `knowledgeRelations`.
- `relation-types.json`: relation taxonomy (`common` + discipline-specific + provenance-only).
- `knowledge-graph.json`: generated payload consumed by `graph.html`.
- `tuning-config.json`: manual tuning profile for graph rendering/debug parameters.
- `schema.json`: schema for generated dual-view graph output.

## Provenance design

The following source relations are **tooltip-only** in knowledge mode (not rendered as graph nodes):

- `defined_in`
- `cite_from`
- `support`

They are stored under each knowledge node as `provenanceLinks`.

## DB-first export flow (recommended)

1. Import source/PDF data into DB (see `db/README.md`).
2. Run `tools/db-to-graph.py --db db/graph.db --out graph/knowledge-graph.json`.
3. Open `graph.html` to view the latest DB-exported snapshot.

## Manual tuning interface

`graph.html` includes a tuning panel for key parameters:

- `nodeSizeScale`
- `degreeGain`
- `edgeWidthScale`
- `levelSeparation`
- `nodeSpacing`
- `physicsIterations`

At startup, the UI reads `tuning-config.json` so manual debugging values can be preserved across refreshes.

## Edge strategy

- Use `commonRelations` for cross-discipline structure.
- Use `disciplineRelations` for mathematics / physics / computer-science specific logic.
- Keep provenance separate from semantic knowledge edges.
