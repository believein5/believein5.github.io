# Graph directory

This folder now uses a **source-first architecture** with two graph views:

- **Book Graph**: `Book -> Chapter -> Section -> Knowledge`
- **Knowledge Graph**: knowledge nodes linked by semantic relations (no source nodes shown)

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

## Generation flow

1. Edit `source.json` (book hierarchy + knowledge nodes + knowledgeRelations).
2. Edit `relation-types.json` when adding new edge semantics.
3. Run `tools/source-to-graph.mjs` to generate `knowledge-graph.json`.
4. Open `graph.html` and switch between **书籍 Graph** and **知识 Graph**.
5. (Optional) adjust persistent rendering defaults in `tuning-config.json`.

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
