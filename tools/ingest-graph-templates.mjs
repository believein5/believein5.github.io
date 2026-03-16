import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const graphPath = path.join(rootDir, 'graph', 'knowledge-graph.json');
const inboxDir = path.join(rootDir, 'graph', 'inbox');
const processedDir = path.join(inboxDir, 'processed');

const REQUIRED_NODE_FIELDS = [
  'id',
  'title',
  'type',
  'summary',
  'difficulty',
  'tags',
  'learningObjective',
  'retrievalKeywords'
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function bumpPatch(version = '0.1.0') {
  const parts = String(version).split('.');
  if (parts.length === 0) {
    return '0.1.0';
  }
  const last = Number.parseInt(parts.at(-1), 10);
  if (Number.isNaN(last)) {
    return version;
  }
  parts[parts.length - 1] = String(last + 1);
  return parts.join('.');
}

function ensureNodeCompleteness(node) {
  for (const field of REQUIRED_NODE_FIELDS) {
    if (node[field] === undefined || node[field] === null) {
      throw new Error(`Node ${node.id || '(missing id)'} is missing required field: ${field}`);
    }
  }
}

function normalizeKnowledgeNode(rawNode, existingNode) {
  const base = existingNode ? { ...existingNode } : {};
  const node = {
    ...base,
    ...rawNode,
    type: rawNode.type ?? base.type ?? 'concept',
    difficulty: rawNode.difficulty ?? base.difficulty ?? 'beginner',
    tags: rawNode.tags ?? base.tags ?? [],
    aliases: rawNode.aliases ?? base.aliases ?? [],
    learningObjective: rawNode.learningObjective ?? base.learningObjective ?? '',
    commonErrors: rawNode.commonErrors ?? base.commonErrors ?? [],
    verificationSteps: rawNode.verificationSteps ?? base.verificationSteps ?? [],
    retrievalKeywords:
      rawNode.retrievalKeywords ??
      base.retrievalKeywords ??
      [rawNode.title || base.title || rawNode.id || base.id].filter(Boolean),
    projectLinks: rawNode.projectLinks ?? base.projectLinks ?? [],
    sourcePath:
      rawNode.sourcePath ??
      base.sourcePath ??
      `graph/nodes/${rawNode.id || base.id}.md`
  };

  ensureNodeCompleteness(node);
  return node;
}

function normalizeSourceNode(rawNode, existingNode) {
  const base = existingNode ? { ...existingNode } : {};
  const node = {
    ...base,
    ...rawNode,
    type: 'source',
    difficulty: rawNode.difficulty ?? base.difficulty ?? 'intermediate',
    tags: rawNode.tags ?? base.tags ?? ['source'],
    aliases: rawNode.aliases ?? base.aliases ?? [],
    learningObjective: rawNode.learningObjective ?? base.learningObjective ?? 'Track provenance for knowledge claims.',
    commonErrors: rawNode.commonErrors ?? base.commonErrors ?? [],
    verificationSteps: rawNode.verificationSteps ?? base.verificationSteps ?? ['Check source locator and bibliographic metadata.'],
    retrievalKeywords:
      rawNode.retrievalKeywords ??
      base.retrievalKeywords ??
      [rawNode.title || base.title || rawNode.id || base.id].filter(Boolean),
    projectLinks: rawNode.projectLinks ?? base.projectLinks ?? [],
    sourcePath:
      rawNode.sourcePath ??
      base.sourcePath ??
      `graph/sources/${(rawNode.id || base.id || 'source').replace(/-/g, '-')}.md`,
    sourceType: rawNode.sourceType ?? base.sourceType ?? 'book-section'
  };

  ensureNodeCompleteness(node);
  return node;
}

function edgeKey(edge) {
  return `${edge.source}::${edge.type}::${edge.target}`;
}

function normalizeEdge(rawEdge, existingEdge) {
  if (!rawEdge.source || !rawEdge.target || !rawEdge.type || !rawEdge.reason) {
    throw new Error(`Invalid edge. Required: source, target, type, reason. Got: ${JSON.stringify(rawEdge)}`);
  }

  return {
    ...(existingEdge || {}),
    ...rawEdge,
    weight: rawEdge.weight ?? existingEdge?.weight
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function getIngestFiles() {
  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(processedDir, { recursive: true });

  const entries = await fs.readdir(inboxDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.json'))
    .filter((name) => !name.startsWith('_'))
    .map((name) => path.join(inboxDir, name));
}

async function ingestOneFile(graph, filePath) {
  const payload = await readJson(filePath);

  const knowledgeNodes = Array.isArray(payload.knowledgeNodes) ? payload.knowledgeNodes : [];
  const sourceNodes = Array.isArray(payload.sourceNodes) ? payload.sourceNodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));

  let nodeUpserts = 0;
  let edgeUpserts = 0;

  for (const rawNode of knowledgeNodes) {
    const existing = nodeMap.get(rawNode.id);
    const normalized = normalizeKnowledgeNode(rawNode, existing);
    nodeMap.set(normalized.id, normalized);
    nodeUpserts += 1;
  }

  for (const rawNode of sourceNodes) {
    const existing = nodeMap.get(rawNode.id);
    const normalized = normalizeSourceNode(rawNode, existing);
    nodeMap.set(normalized.id, normalized);
    nodeUpserts += 1;
  }

  for (const rawEdge of edges) {
    const key = edgeKey(rawEdge);
    const existing = edgeMap.get(key);
    const normalized = normalizeEdge(rawEdge, existing);
    edgeMap.set(key, normalized);
    edgeUpserts += 1;
  }

  graph.nodes = Array.from(nodeMap.values());
  graph.edges = Array.from(edgeMap.values());

  const doneName = `${path.basename(filePath, '.json')}.${Date.now()}.done.json`;
  const donePath = path.join(processedDir, doneName);
  await fs.rename(filePath, donePath);

  return { nodeUpserts, edgeUpserts, donePath };
}

async function main() {
  const graph = await readJson(graphPath);
  const ingestFiles = await getIngestFiles();

  if (ingestFiles.length === 0) {
    console.log('No ingest files found. Put JSON files in graph/inbox/ and run again.');
    return;
  }

  let totalNodes = 0;
  let totalEdges = 0;

  for (const filePath of ingestFiles) {
    const result = await ingestOneFile(graph, filePath);
    totalNodes += result.nodeUpserts;
    totalEdges += result.edgeUpserts;
    console.log(`Ingested ${path.basename(filePath)} => nodes:${result.nodeUpserts}, edges:${result.edgeUpserts}`);
  }

  graph.meta = graph.meta || {};
  graph.meta.updatedAt = today();
  graph.meta.version = bumpPatch(graph.meta.version);

  await writeJson(graphPath, graph);

  console.log(`Done. Updated graph with nodes:${totalNodes}, edges:${totalEdges}`);
  console.log(`New version: ${graph.meta.version}, updatedAt: ${graph.meta.updatedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
