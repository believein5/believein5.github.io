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

const KNOWLEDGE_INDEX_DOMAINS = new Set([
  'philosophy',
  'mathematics',
  'physics',
  'economics',
  'neuroscience',
  'psychology',
  'computer-science',
  'control-theory-cybernetics',
  'linguistics',
  'artificial-intelligence'
]);

const DISCIPLINE_BASE_MAPPING = {
  mathematics: 'mathematics',
  physics: 'physics',
  economics: 'economics',
  neuroscience: 'neuroscience',
  psychology: 'psychology',
  linguistics: 'linguistics',
  'control-theory-cybernetics': 'control-theory-cybernetics',
  'computer-science': 'computer-science',
  'artificial-intelligence': 'artificial-intelligence'
};

function asI18n(value, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const zh = String(value.zh ?? value.en ?? fallback ?? '').trim();
    const en = String(value.en ?? value.zh ?? fallback ?? '').trim();
    return { zh, en };
  }
  const text = String(value ?? fallback ?? '').trim();
  return { zh: text, en: text };
}

function pickLang(i18n, lang = 'zh') {
  const normalized = asI18n(i18n, '');
  return normalized[lang] || normalized.zh || normalized.en || '';
}

function inferTaxonomyDomain({ book, chapter, section, knowledge }) {
  const direct = DISCIPLINE_BASE_MAPPING[book?.discipline];
  const raw = [
    book?.id,
    book?.title,
    chapter?.id,
    chapter?.title,
    section?.id,
    section?.title,
    knowledge?.id,
    knowledge?.title,
    ...(knowledge?.tags || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\bai\b|artificial intelligence|机器学习|深度学习|智能体|推理/.test(raw)) {
    return 'artificial-intelligence';
  }
  if (/控制|control|cybernetics|feedback|stability/.test(raw)) {
    return 'control-theory-cybernetics';
  }
  if (/语义|语法|语用|linguistic|semantics|syntax|pragmatic/.test(raw)) {
    return 'linguistics';
  }
  if (/神经|neuro|brain|memory/.test(raw)) {
    return 'neuroscience';
  }
  if (/心理|cognitive|behavior|bias|motivation/.test(raw)) {
    return 'psychology';
  }
  if (/经济|finance|market|risk|quant/.test(raw)) {
    return 'economics';
  }
  if (/数学|math|algebra|probability|optimization|信息论/.test(raw)) {
    return 'mathematics';
  }
  if (/物理|physics|dynamics|electromagnet|maxwell/.test(raw)) {
    return 'physics';
  }
  if (direct && KNOWLEDGE_INDEX_DOMAINS.has(direct)) {
    return direct;
  }
  return 'computer-science';
}

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
  const bookTitleI18n = asI18n(base?.bookTitleI18n ?? base?.bookTitle ?? book.titleI18n ?? book.title, book.title);
  const chapterI18n = asI18n(base?.chapterI18n ?? base?.chapter ?? chapter.titleI18n ?? chapter.title, chapter.title);
  const sectionI18n = asI18n(base?.sectionI18n ?? base?.section ?? section.titleI18n ?? section.title, section.title);

  return {
    type: base?.type || 'defined_in',
    bookId: base?.bookId || book.id,
    bookTitleI18n,
    chapterI18n,
    sectionI18n,
    bookTitle: pickLang(bookTitleI18n, 'zh'),
    chapter: pickLang(chapterI18n, 'zh'),
    section: pickLang(sectionI18n, 'zh'),
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
    const bookTitleI18n = asI18n(book.titleI18n ?? book.title, book.title);
    const bookDomain = inferTaxonomyDomain({ book });
    bookNodes.push({
      id: bookNodeId,
      rawId: book.id,
      titleI18n: bookTitleI18n,
      title: pickLang(bookTitleI18n, 'zh'),
      type: 'book',
      discipline: book.discipline,
      taxonomyDomain: bookDomain
    });

    for (const chapter of book.chapters || []) {
      const chapterNodeId = `chapter:${chapter.id}`;
      const chapterTitleI18n = asI18n(chapter.titleI18n ?? chapter.title, chapter.title);
      const chapterDomain = inferTaxonomyDomain({ book, chapter });
      bookNodes.push({
        id: chapterNodeId,
        rawId: chapter.id,
        titleI18n: chapterTitleI18n,
        title: pickLang(chapterTitleI18n, 'zh'),
        type: 'chapter',
        discipline: book.discipline,
        taxonomyDomain: chapterDomain,
        bookId: book.id,
        bookTitleI18n,
        bookTitle: pickLang(bookTitleI18n, 'zh')
      });

      const hasChapterReasonI18n = {
        zh: `${pickLang(bookTitleI18n, 'zh')} 包含章节 ${pickLang(chapterTitleI18n, 'zh')}`,
        en: `${pickLang(bookTitleI18n, 'en')} includes chapter ${pickLang(chapterTitleI18n, 'en')}`
      };
      bookEdges.push({
        source: bookNodeId,
        target: chapterNodeId,
        type: 'has_chapter',
        reasonI18n: hasChapterReasonI18n,
        reason: pickLang(hasChapterReasonI18n, 'zh')
      });

      for (const section of chapter.sections || []) {
        const sectionNodeId = `section:${section.id}`;
        const sectionTitleI18n = asI18n(section.titleI18n ?? section.title, section.title);
        const sectionDomain = inferTaxonomyDomain({ book, chapter, section });
        bookNodes.push({
          id: sectionNodeId,
          rawId: section.id,
          titleI18n: sectionTitleI18n,
          title: pickLang(sectionTitleI18n, 'zh'),
          type: 'section',
          discipline: book.discipline,
          taxonomyDomain: sectionDomain,
          bookId: book.id,
          bookTitleI18n,
          bookTitle: pickLang(bookTitleI18n, 'zh'),
          chapterId: chapter.id,
          chapterTitleI18n,
          chapterTitle: pickLang(chapterTitleI18n, 'zh')
        });

        const hasSectionReasonI18n = {
          zh: `${pickLang(chapterTitleI18n, 'zh')} 包含小节 ${pickLang(sectionTitleI18n, 'zh')}`,
          en: `${pickLang(chapterTitleI18n, 'en')} includes section ${pickLang(sectionTitleI18n, 'en')}`
        };
        bookEdges.push({
          source: chapterNodeId,
          target: sectionNodeId,
          type: 'has_section',
          reasonI18n: hasSectionReasonI18n,
          reason: pickLang(hasSectionReasonI18n, 'zh')
        });

        for (const knowledge of section.knowledge || []) {
          const knowledgeNodeId = `knowledge:${knowledge.id}`;
          const knowledgeTitleI18n = asI18n(knowledge.titleI18n ?? knowledge.title, knowledge.title);
          const knowledgeSummaryI18n = asI18n(knowledge.summaryI18n ?? knowledge.summary, knowledge.summary);
          const knowledgeDomain = inferTaxonomyDomain({ book, chapter, section, knowledge });

          bookNodes.push({
            id: knowledgeNodeId,
            rawId: knowledge.id,
            titleI18n: knowledgeTitleI18n,
            title: pickLang(knowledgeTitleI18n, 'zh'),
            summaryI18n: knowledgeSummaryI18n,
            summary: pickLang(knowledgeSummaryI18n, 'zh'),
            type: 'knowledge',
            knowledgeType: knowledge.type || 'concept',
            discipline: book.discipline,
            taxonomyDomain: knowledgeDomain,
            bookId: book.id,
            bookTitleI18n,
            bookTitle: pickLang(bookTitleI18n, 'zh'),
            chapterId: chapter.id,
            chapterTitleI18n,
            chapterTitle: pickLang(chapterTitleI18n, 'zh'),
            sectionId: section.id,
            sectionTitleI18n,
            sectionTitle: pickLang(sectionTitleI18n, 'zh')
          });

          const coversReasonI18n = {
            zh: `${pickLang(sectionTitleI18n, 'zh')} 涵盖知识点 ${pickLang(knowledgeTitleI18n, 'zh')}`,
            en: `${pickLang(sectionTitleI18n, 'en')} covers knowledge ${pickLang(knowledgeTitleI18n, 'en')}`
          };

          bookEdges.push({
            source: sectionNodeId,
            target: knowledgeNodeId,
            type: 'covers_knowledge',
            reasonI18n: coversReasonI18n,
            reason: pickLang(coversReasonI18n, 'zh')
          });

          const defaultDefinedIn = normalizeProvenance({ type: 'defined_in' }, book, chapter, section);
          const explicitLinks = Array.isArray(knowledge.provenanceLinks)
            ? knowledge.provenanceLinks.map((link) => normalizeProvenance(link, book, chapter, section))
            : [];

          const merged = knowledgeMap.get(knowledge.id) || {
            id: knowledge.id,
            titleI18n: knowledgeTitleI18n,
            title: pickLang(knowledgeTitleI18n, 'zh'),
            type: knowledge.type || 'concept',
            discipline: book.discipline,
            taxonomyDomain: knowledgeDomain,
            summaryI18n: knowledgeSummaryI18n,
            summary: pickLang(knowledgeSummaryI18n, 'zh'),
            difficulty: knowledge.difficulty || 'beginner',
            tags: knowledge.tags || [],
            provenanceLinks: []
          };

          merged.provenanceLinks.push(defaultDefinedIn, ...explicitLinks);
          merged.tags = [...new Set([...(merged.tags || []), ...(knowledge.tags || [])])];
          if (!merged.summary && knowledge.summary) merged.summary = knowledge.summary;
          merged.titleI18n = asI18n(merged.titleI18n ?? knowledgeTitleI18n, knowledge.title);
          merged.summaryI18n = asI18n(merged.summaryI18n ?? knowledgeSummaryI18n, knowledge.summary);

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
      reasonI18n: asI18n(rel.reasonI18n ?? rel.reason, rel.reason),
      reason: rel.reason || '',
      weight: rel.weight ?? null
    };

    normalized.reason = pickLang(normalized.reasonI18n, 'zh');

    edgeMap.set(edgeKey(normalized), normalized);
  }

  const knowledgeEdges = [...edgeMap.values()];

  const nodeTypeSet = new Set(knowledgeNodes.map((n) => n.type));
  const edgeTypeSet = new Set(knowledgeEdges.map((e) => e.type));
  const domainSet = new Set([
    ...bookNodes.map((n) => n.taxonomyDomain).filter(Boolean),
    ...knowledgeNodes.map((n) => n.taxonomyDomain).filter(Boolean)
  ]);

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
      knowledgeNodeTypes: [...nodeTypeSet].sort(),
      taxonomyDomains: [...domainSet].sort()
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
