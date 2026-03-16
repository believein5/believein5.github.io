import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'graph', 'source.json');

function toI18n(value, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const zh = String(value.zh ?? value.en ?? fallback ?? '').trim();
    const en = String(value.en ?? value.zh ?? fallback ?? '').trim();
    return { zh, en };
  }

  const text = String(value ?? fallback ?? '').trim();
  return { zh: text, en: text };
}

function migrateProvenanceLink(link) {
  const next = { ...link };
  next.bookTitleI18n = toI18n(link.bookTitleI18n ?? link.bookTitle, link.bookTitle);
  next.chapterI18n = toI18n(link.chapterI18n ?? link.chapter, link.chapter);
  next.sectionI18n = toI18n(link.sectionI18n ?? link.section, link.section);
  return next;
}

function migrateKnowledge(knowledge) {
  const next = { ...knowledge };
  next.titleI18n = toI18n(knowledge.titleI18n ?? knowledge.title, knowledge.title);
  next.summaryI18n = toI18n(knowledge.summaryI18n ?? knowledge.summary, knowledge.summary);

  if (Array.isArray(knowledge.provenanceLinks)) {
    next.provenanceLinks = knowledge.provenanceLinks.map(migrateProvenanceLink);
  }

  return next;
}

function migrateSection(section) {
  const next = { ...section };
  next.titleI18n = toI18n(section.titleI18n ?? section.title, section.title);
  next.knowledge = (section.knowledge || []).map(migrateKnowledge);
  return next;
}

function migrateChapter(chapter) {
  const next = { ...chapter };
  next.titleI18n = toI18n(chapter.titleI18n ?? chapter.title, chapter.title);
  next.sections = (chapter.sections || []).map(migrateSection);
  return next;
}

function migrateBook(book) {
  const next = { ...book };
  next.titleI18n = toI18n(book.titleI18n ?? book.title, book.title);
  next.chapters = (book.chapters || []).map(migrateChapter);
  return next;
}

function migrateRelation(rel) {
  const next = { ...rel };
  next.reasonI18n = toI18n(rel.reasonI18n ?? rel.reason, rel.reason);
  return next;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  const source = await readJson(sourcePath);

  source.meta = source.meta || {};
  source.meta.i18n = {
    enabled: true,
    primary: 'zh',
    secondary: 'en'
  };

  source.books = (source.books || []).map(migrateBook);
  source.knowledgeRelations = (source.knowledgeRelations || []).map(migrateRelation);

  await writeJson(sourcePath, source);
  console.log('Migrated source.json to include i18n fields for titles, summaries, provenance links, and relation reasons.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
