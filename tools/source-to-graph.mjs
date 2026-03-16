import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourcePath = path.join(rootDir, 'graph', 'source.json');
const relationTypesPath = path.join(rootDir, 'graph', 'relation-types.json');
const outputPath = path.join(rootDir, 'graph', 'knowledge-graph.json');

const PROVENANCE_TYPES = new Set(['defined_in', 'cite_from', 'support']);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function bumpPatch(version = '1.0.0') {
  const parts = String(version).split('.');
  if (parts.length !== 3) return version;
  const patch = Number.parseInt(parts[2], 10);
  if (Number.isNaN(patch)) return version;
  parts[2] = String(patch + 1);
  return parts.join('.');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function normalizeProvenance(base, book, chapter, section) {
  return {
    type: base?.type || 'defined_in',
    bookId: base?.bookId || book.id,
    bookTitle: base?.bookTitle || book.title,
    chapter: base?.chapter || chapter.title,
    section: base?.section || section.title,
    link: base?.link || `graph/source.json?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(chapter.id)}&section=${encodeURIComponent(section.id)}`
  };
}

function edgeKey(edge) {
  return `${edge.source}::${edge.type}::${edge.target}`;
}

function mergeUniqueLinks(links) {
  const map = new Map();
  for (const item of links) {
    const key = `${item.type}|${item.bookId}|${item.chapter}|${item.section}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function buildGraphs(sourceTree, relationTypes) {
  const bookNodes = [];
  const bookEdges = [];

  const knowledgeMap = new Map();

  for (const book of sourceTree.books || []) {
    const bookNodeId = `book:${book.id}`;
    bookNodes.push({
      id: bookNodeId,
      rawId: book.id,
      title: book.title,
      type: 'book',
      discipline: book.discipline
    });

    for (const chapter of book.chapters || []) {
      const chapterNodeId = `chapter:${chapter.id}`;
      bookNodes.push({
        id: chapterNodeId,
        rawId: chapter.id,
        title: chapter.title,
        type: 'chapter',
        discipline: book.discipline,
        bookId: book.id,
        bookTitle: book.title
      });
      bookEdges.push({
        source: bookNodeId,
        target: chapterNodeId,
        type: 'has_chapter',
        reason: `${book.title} 包含章节 ${chapter.title}`
      });

      for (const section of chapter.sections || []) {
        const sectionNodeId = `section:${section.id}`;
        bookNodes.push({
          id: sectionNodeId,
          rawId: section.id,
          title: section.title,
          type: 'section',
          discipline: book.discipline,
          bookId: book.id,
          bookTitle: book.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title
        });
        bookEdges.push({
          source: chapterNodeId,
          target: sectionNodeId,
          type: 'has_section',
          reason: `${chapter.title} 包含小节 ${section.title}`
        });

        for (const knowledge of section.knowledge || []) {
          const knowledgeNodeId = `knowledge:${knowledge.id}`;

          bookNodes.push({
            id: knowledgeNodeId,
            rawId: knowledge.id,
            title: knowledge.title,
            type: 'knowledge',
            knowledgeType: knowledge.type || 'concept',
            discipline: book.discipline,
            bookId: book.id,
            bookTitle: book.title,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            sectionId: section.id,
            sectionTitle: section.title
          });

          bookEdges.push({
            source: sectionNodeId,
            target: knowledgeNodeId,
            type: 'covers_knowledge',
            reason: `${section.title} 涵盖知识点 ${knowledge.title}`
          });

          const defaultDefinedIn = normalizeProvenance({ type: 'defined_in' }, book, chapter, section);
          const explicitLinks = Array.isArray(knowledge.provenanceLinks)
            ? knowledge.provenanceLinks.map((link) => normalizeProvenance(link, book, chapter, section))
            : [];

          const merged = knowledgeMap.get(knowledge.id) || {
            id: knowledge.id,
            title: knowledge.title,
            type: knowledge.type || 'concept',
            discipline: book.discipline,
            summary: knowledge.summary || '',
            difficulty: knowledge.difficulty || 'beginner',
            tags: knowledge.tags || [],
            provenanceLinks: []
          };

          merged.provenanceLinks.push(defaultDefinedIn, ...explicitLinks);
          merged.tags = [...new Set([...(merged.tags || []), ...(knowledge.tags || [])])];
          if (!merged.summary && knowledge.summary) merged.summary = knowledge.summary;

          knowledgeMap.set(knowledge.id, merged);
        }
      }
    }
  }

  const knowledgeNodes = [...knowledgeMap.values()].map((node) => ({
    ...node,
    provenanceLinks: mergeUniqueLinks(node.provenanceLinks || [])
  }));

  const validKnowledgeIds = new Set(knowledgeNodes.map((n) => n.id));
  const edgeMap = new Map();

  for (const rel of sourceTree.knowledgeRelations || []) {
    if (PROVENANCE_TYPES.has(rel.type)) {
      continue;
    }
    if (!validKnowledgeIds.has(rel.source) || !validKnowledgeIds.has(rel.target)) {
      continue;
    }

    const normalized = {
      source: rel.source,
      target: rel.target,
      type: rel.type,
      domain: rel.domain || 'common',
      reason: rel.reason || '',
      weight: rel.weight ?? null
    };

    edgeMap.set(edgeKey(normalized), normalized);
  }

  const knowledgeEdges = [...edgeMap.values()];

  const nodeTypeSet = new Set(knowledgeNodes.map((n) => n.type));
  const edgeTypeSet = new Set(knowledgeEdges.map((e) => e.type));

  return {
    bookGraph: {
      nodes: bookNodes,
      edges: bookEdges
    },
    knowledgeGraph: {
      nodes: knowledgeNodes,
      edges: knowledgeEdges
    },
    stats: {
      books: (sourceTree.books || []).length,
      knowledgeNodes: knowledgeNodes.length,
      knowledgeEdgeTypes: [...edgeTypeSet].sort(),
      knowledgeNodeTypes: [...nodeTypeSet].sort()
    },
    relationTypes
  };
}

async function main() {
  const sourceTree = await readJson(sourcePath);
  const relationTypes = await readJson(relationTypesPath);

  const existing = await readJson(outputPath).catch(() => ({ meta: { version: '1.0.0' } }));
  const built = buildGraphs(sourceTree, relationTypes);

  const output = {
    meta: {
      title: 'Knowledge Graph Views',
      version: bumpPatch(existing?.meta?.version || sourceTree?.meta?.version || '1.0.0'),
      updatedAt: today(),
      description: 'Generated graph data containing book hierarchy view and knowledge relation view.',
      language: sourceTree?.meta?.language || 'zh-CN'
    },
    sourceRef: {
      file: 'graph/source.json',
      relationTypeFile: 'graph/relation-types.json'
    },
    relationTypes: built.relationTypes,
    stats: built.stats,
    views: {
      book: built.bookGraph,
      knowledge: built.knowledgeGraph
    }
  };

  await writeJson(outputPath, output);
  console.log(`Generated ${path.relative(rootDir, outputPath)} | nodes=${built.stats.knowledgeNodes}, relationTypes=${built.stats.knowledgeEdgeTypes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
