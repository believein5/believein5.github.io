# Database bootstrap (DB-first unified model)

This folder defines a **SQLite-first, DB-first** schema for your project.

## Why this schema

It maps your knowledge + graph data into one canonical model:

- `Book -> Chapter -> Section -> Knowledge`
- semantic relations for knowledge graph edges
- `defined_in/cite_from/support` as provenance metadata (not graph nodes)
- graph read models (views) for exporter scripts
- global graph tuning + import run history in DB

## Files

- `schema.sql`: full schema + indexes + taxonomy seed data.

## DB structure overview

### Core tables

- `books`, `chapters`, `sections`: hierarchy backbone
- `knowledge_nodes`: canonical knowledge entities
- `section_knowledge`: mapping knowledge into one/many sections
- `knowledge_tags`: node tags
- `knowledge_relations`: semantic graph edges
- `provenance_links`: source evidence edges (tooltip/detail use)
- `relation_types`: edge taxonomy dictionary
- `taxonomy_domains`: discipline domain dictionary

### Pipeline / operations tables

- `ingest_queue`: automated ingestion queue state
- `source_import_runs`: each import execution log + stats
- `source_snapshots`: optional raw source snapshot archive
- `app_settings`: global runtime config (including graph tuning defaults)

### Export views (read model)

- `v_book_graph_nodes`
- `v_book_graph_edges`
- `v_knowledge_graph_nodes`
- `v_knowledge_graph_edges`
- `v_knowledge_provenance`

These views are intended as the direct source for `db -> graph/knowledge-graph.json` exporters.

## How to initialize

1. Create a database file, e.g. `graph.db`.
2. Execute `schema.sql` against it.
3. Import `graph/source.json` data using an ETL script (next step).

## Source import/update workflow

This repo now provides a generator script:

- `tools/source-to-db-sql.mjs`

It reads:

- `graph/source.json`
- `graph/relation-types.json`

And outputs:

- `db/import-source.sql`

`db/import-source.sql` is a **full refresh sync** script (transactional):

- clears hierarchy/knowledge/relation/provenance tables in safe order
- re-inserts data from current source
- supports repeated execution after source updates

Recommended cycle:

1. Edit `graph/source.json`
2. Regenerate `db/import-source.sql`
3. Apply `db/import-source.sql` to your SQLite DB
4. Export DB -> `graph/knowledge-graph.json` for frontend

## Recommended ETL order (source.json -> DB)

1. Insert books
2. Insert chapters
3. Insert sections
4. Upsert knowledge nodes
5. Insert section_knowledge mapping
6. Insert tags
7. Insert semantic relations (`knowledge_relations`)
8. Insert provenance links (`provenance_links`)

## Minimal validation checks after import

- Every `knowledge_nodes.id` appears in at least one `section_knowledge`
- Every `knowledge_relations.source_id/target_id` exists in `knowledge_nodes`
- `provenance_links.provenance_type` only in (`defined_in`, `cite_from`, `support`)
- `taxonomy_domain` belongs to the 10 index domains

## Next pipeline step

After data is in DB, export back to `graph/knowledge-graph.json` for frontend rendering.
This keeps runtime static and fast while authoring/storage becomes structured.

## Should source be kept after import?

Short term: yes. Long term: optional.

- During migration, keep `source.json` as human-editable upstream source.
- After DB workflows stabilize, you may switch to DB as SSOT and keep `source.json` as exported snapshot/archive.
- Do not edit generated `db/import-source.sql` manually.

