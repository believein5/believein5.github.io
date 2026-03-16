import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourcePath = path.join(rootDir, 'graph', 'source.json');
const relationTypesPath = path.join(rootDir, 'graph', 'relation-types.json');
const outputSqlPath = path.join(rootDir, 'db', 'import-source.sql');

const PROVENANCE_TYPES = new Set(['defined_in', 'cite_from', 'support']);

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

  if (/\bai\b|artificial intelligence|机器学习|深度学习|智能体|推理/.test(raw)) return 'artificial-intelligence';
  if (/控制|control|cybernetics|feedback|stability/.test(raw)) return 'control-theory-cybernetics';
  if (/语义|语法|语用|linguistic|semantics|syntax|pragmatic/.test(raw)) return 'linguistics';
  if (/神经|neuro|brain|memory/.test(raw)) return 'neuroscience';
  if (/心理|cognitive|behavior|bias|motivation/.test(raw)) return 'psychology';
  if (/经济|finance|market|risk|quant/.test(raw)) return 'economics';
  if (/数学|math|algebra|probability|optimization|信息论/.test(raw)) return 'mathematics';
  if (/物理|physics|dynamics|electromagnet|maxwell/.test(raw)) return 'physics';
  if (direct && KNOWLEDGE_INDEX_DOMAINS.has(direct)) return direct;
  return 'computer-science';
}

function normalizeProvenance(base, book, chapter, section) {
  const bookTitleI18n = asI18n(base?.bookTitleI18n ?? base?.bookTitle ?? book.titleI18n ?? book.title, book.title);
  const chapterI18n = asI18n(base?.chapterI18n ?? base?.chapter ?? chapter.titleI18n ?? chapter.title, chapter.title);
  const sectionI18n = asI18n(base?.sectionI18n ?? base?.section ?? section.titleI18n ?? section.title, section.title);

  return {
    type: base?.type || 'defined_in',
    bookId: base?.bookId || book.id,
    chapterId: base?.chapterId || chapter.id,
    sectionId: base?.sectionId || section.id,
    bookTitle: pickLang(bookTitleI18n, 'zh'),
    chapterTitle: pickLang(chapterI18n, 'zh'),
    sectionTitle: pickLang(sectionI18n, 'zh'),
    bookTitleZh: bookTitleI18n.zh,
    bookTitleEn: bookTitleI18n.en,
    chapterTitleZh: chapterI18n.zh,
    chapterTitleEn: chapterI18n.en,
    sectionTitleZh: sectionI18n.zh,
    sectionTitleEn: sectionI18n.en,
    link: base?.link || `graph/source.json?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(chapter.id)}&section=${encodeURIComponent(section.id)}`
  };
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  const text = String(value).replaceAll("'", "''");
  return `'${text}'`;
}

function row(values) {
  return `(${values.map((v) => escapeSql(v)).join(', ')})`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function relationTypeRows(relationTypes) {
  const rows = [];

  for (const rel of relationTypes.provenanceRelations || []) {
    rows.push([
      rel.type,
      'provenance',
      null,
      rel.description || '',
      rel.direction || '',
      0,
      0,
      rel.display || 'tooltip-only'
    ]);
  }

  for (const rel of relationTypes.commonRelations || []) {
    rows.push([
      rel.type,
      'common',
      null,
      rel.description || '',
      rel.direction || '',
      rel.transitive ? 1 : 0,
      rel.symmetric ? 1 : 0,
      'graph'
    ]);
  }

  for (const [discipline, rels] of Object.entries(relationTypes.disciplineRelations || {})) {
    for (const rel of rels || []) {
      rows.push([
        rel.type,
        'discipline',
        discipline,
        rel.description || '',
        rel.direction || '',
        0,
        0,
        'graph'
      ]);
    }
  }

  return rows;
}

function buildRows(sourceTree) {
  const books = [];
  const chapters = [];
  const sections = [];
  const knowledgeNodes = new Map();
  const sectionKnowledge = [];
  const knowledgeTags = [];
  const provenanceRows = [];

  for (const book of sourceTree.books || []) {
    const bookI18n = asI18n(book.titleI18n ?? book.title, book.title);
    const bookDomain = inferTaxonomyDomain({ book });
    books.push([
      book.id,
      book.title,
      bookI18n.zh,
      bookI18n.en,
      book.discipline,
      bookDomain,
      new Date().toISOString()
    ]);

    (book.chapters || []).forEach((chapter, chapterIndex) => {
      const chapterI18n = asI18n(chapter.titleI18n ?? chapter.title, chapter.title);
      chapters.push([
        chapter.id,
        book.id,
        chapter.title,
        chapterI18n.zh,
        chapterI18n.en,
        chapterIndex + 1
      ]);

      (chapter.sections || []).forEach((section, sectionIndex) => {
        const sectionI18n = asI18n(section.titleI18n ?? section.title, section.title);
        sections.push([
          section.id,
          chapter.id,
          section.title,
          sectionI18n.zh,
          sectionI18n.en,
          sectionIndex + 1
        ]);

        (section.knowledge || []).forEach((knowledge, knowledgeIndex) => {
          const knowledgeI18n = asI18n(knowledge.titleI18n ?? knowledge.title, knowledge.title);
          const summaryI18n = asI18n(knowledge.summaryI18n ?? knowledge.summary, knowledge.summary || '');
          const taxonomyDomain = inferTaxonomyDomain({ book, chapter, section, knowledge });

          const existing = knowledgeNodes.get(knowledge.id);
          if (!existing) {
            knowledgeNodes.set(knowledge.id, [
              knowledge.id,
              knowledge.title,
              knowledgeI18n.zh,
              knowledgeI18n.en,
              knowledge.summary || '',
              summaryI18n.zh,
              summaryI18n.en,
              knowledge.type || 'concept',
              knowledge.difficulty || 'beginner',
              taxonomyDomain,
              book.discipline,
              'active',
              new Date().toISOString()
            ]);
          }

          sectionKnowledge.push([
            section.id,
            knowledge.id,
            knowledgeIndex + 1
          ]);

          for (const tag of knowledge.tags || []) {
            knowledgeTags.push([knowledge.id, tag]);
          }

          const defaultDefinedIn = normalizeProvenance({ type: 'defined_in' }, book, chapter, section);
          const explicit = Array.isArray(knowledge.provenanceLinks)
            ? knowledge.provenanceLinks.map((p) => normalizeProvenance(p, book, chapter, section))
            : [];

          const allProv = [defaultDefinedIn, ...explicit];
          for (const p of allProv) {
            provenanceRows.push([
              knowledge.id,
              p.type,
              p.bookId,
              p.chapterId,
              p.sectionId,
              p.bookTitle,
              p.chapterTitle,
              p.sectionTitle,
              p.bookTitleZh,
              p.bookTitleEn,
              p.chapterTitleZh,
              p.chapterTitleEn,
              p.sectionTitleZh,
              p.sectionTitleEn,
              p.link
            ]);
          }
        });
      });
    });
  }

  return {
    books,
    chapters,
    sections,
    knowledgeNodes: [...knowledgeNodes.values()],
    sectionKnowledge,
    knowledgeTags,
    provenanceRows
  };
}

function buildKnowledgeRelationRows(sourceTree) {
  const rows = [];
  const seen = new Set();
  for (const rel of sourceTree.knowledgeRelations || []) {
    if (PROVENANCE_TYPES.has(rel.type)) continue;
    const key = `${rel.source}|${rel.type}|${rel.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reasonI18n = asI18n(rel.reasonI18n ?? rel.reason, rel.reason || '');
    rows.push([
      rel.source,
      rel.target,
      rel.type,
      rel.domain || 'common',
      rel.reason || '',
      reasonI18n.zh,
      reasonI18n.en,
      rel.weight ?? null,
      1.0,
      'approved'
    ]);
  }
  return rows;
}

function dedupeRows(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, r);
  }
  return [...map.values()];
}

function buildSql({ relationTypeRowsData, rows, relationRows }) {
  const lines = [];
  lines.push('-- Auto-generated by tools/source-to-db-sql.mjs');
  lines.push(`-- Generated at ${new Date().toISOString()}`);
  lines.push('PRAGMA foreign_keys = ON;');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('-- Full refresh (source.json is canonical)');
  lines.push('DELETE FROM provenance_links;');
  lines.push('DELETE FROM knowledge_relations;');
  lines.push('DELETE FROM knowledge_tags;');
  lines.push('DELETE FROM section_knowledge;');
  lines.push('DELETE FROM knowledge_nodes;');
  lines.push('DELETE FROM sections;');
  lines.push('DELETE FROM chapters;');
  lines.push('DELETE FROM books;');
  lines.push('DELETE FROM relation_types;');
  lines.push('');

  if (relationTypeRowsData.length) {
    lines.push('INSERT INTO relation_types (type, category, discipline, description, direction, transitive, symmetric, display_scope) VALUES');
    lines.push(relationTypeRowsData.map((r) => `  ${row(r)}`).join(',\n') + ';');
    lines.push('');
  }

  const blocks = [
    ['books', '(id, title, title_zh, title_en, discipline, taxonomy_domain, updated_at)', rows.books],
    ['chapters', '(id, book_id, title, title_zh, title_en, ord)', rows.chapters],
    ['sections', '(id, chapter_id, title, title_zh, title_en, ord)', rows.sections],
    ['knowledge_nodes', '(id, title, title_zh, title_en, summary, summary_zh, summary_en, knowledge_type, difficulty, taxonomy_domain, discipline, status, updated_at)', rows.knowledgeNodes],
    ['section_knowledge', '(section_id, knowledge_id, ord)', dedupeRows(rows.sectionKnowledge, (r) => `${r[0]}|${r[1]}`)],
    ['knowledge_tags', '(knowledge_id, tag)', dedupeRows(rows.knowledgeTags, (r) => `${r[0]}|${r[1]}`)],
    ['knowledge_relations', '(source_id, target_id, relation_type, domain, reason, reason_zh, reason_en, weight, confidence, review_status)', relationRows],
    ['provenance_links', '(knowledge_id, provenance_type, book_id, chapter_id, section_id, book_title, chapter_title, section_title, book_title_zh, book_title_en, chapter_title_zh, chapter_title_en, section_title_zh, section_title_en, link)', dedupeRows(rows.provenanceRows, (r) => `${r[0]}|${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[14]}`)]
  ];

  for (const [table, columns, dataRows] of blocks) {
    if (!dataRows.length) continue;
    lines.push(`INSERT INTO ${table} ${columns} VALUES`);
    lines.push(dataRows.map((r) => `  ${row(r)}`).join(',\n') + ';');
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const sourceTree = await readJson(sourcePath);
  const relationTypes = await readJson(relationTypesPath);

  const relationTypeRowsData = relationTypeRows(relationTypes);
  const rows = buildRows(sourceTree);
  const relationRows = buildKnowledgeRelationRows(sourceTree);
  const sql = buildSql({ relationTypeRowsData, rows, relationRows });

  await fs.writeFile(outputSqlPath, sql, 'utf8');

  const summary = {
    books: rows.books.length,
    chapters: rows.chapters.length,
    sections: rows.sections.length,
    knowledgeNodes: rows.knowledgeNodes.length,
    sectionKnowledge: rows.sectionKnowledge.length,
    knowledgeTags: rows.knowledgeTags.length,
    knowledgeRelations: relationRows.length,
    provenanceLinks: rows.provenanceRows.length,
    output: path.relative(rootDir, outputSqlPath)
  };

  console.log(`Generated ${summary.output}`);
  console.log(summary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
