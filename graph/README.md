# Graph directory

This folder stores the minimum viable structure for a personal knowledge graph that is both human-readable and agent-trainable.

## Files

- `schema.json`: the data contract for graph nodes and edges.
- `knowledge-graph.json`: the current graph snapshot used by the homepage or future tooling.
- `nodes/`: one Markdown file per node, written for humans first but structured for machines too.

## Recommended update flow

1. Create or edit a node in `nodes/`.
2. Add or update the corresponding node entry in `knowledge-graph.json`.
3. Add edges that explain why nodes are related.
4. Keep `id`, `type`, and `sourcePath` consistent across files.

## Writing rules

- Use stable lowercase kebab-case ids, such as `css-flexbox`.
- Keep summaries short and factual.
- Include learning objectives, common errors, and verification steps.
- Add Chinese and English retrieval keywords when possible.
- Prefer explicit relationships over vague prose.

## Why this structure works

- Humans can read the Markdown node pages directly.
- Agents can parse the JSON graph quickly.
- Future scripts can export the graph to JSONL, embeddings, or visual graph layouts.
