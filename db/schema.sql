PRAGMA foreign_keys = ON;

-- =============================================
-- 1) Master dictionaries
-- =============================================

CREATE TABLE IF NOT EXISTS taxonomy_domains (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relation_types (
  type TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('common', 'discipline', 'provenance')),
  discipline TEXT,
  description TEXT,
  direction TEXT,
  transitive INTEGER DEFAULT 0,
  symmetric INTEGER DEFAULT 0,
  display_scope TEXT DEFAULT 'graph'
);

-- =============================================
-- 2) Book hierarchy (Book -> Chapter -> Section)
-- =============================================

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_zh TEXT,
  title_en TEXT,
  discipline TEXT NOT NULL,
  taxonomy_domain TEXT NOT NULL REFERENCES taxonomy_domains(id),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_zh TEXT,
  title_en TEXT,
  ord INTEGER NOT NULL DEFAULT 0,
  UNIQUE(book_id, ord)
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_zh TEXT,
  title_en TEXT,
  ord INTEGER NOT NULL DEFAULT 0,
  UNIQUE(chapter_id, ord)
);

-- =============================================
-- 3) Knowledge nodes + placement + tags
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_zh TEXT,
  title_en TEXT,
  summary TEXT,
  summary_zh TEXT,
  summary_en TEXT,
  knowledge_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  taxonomy_domain TEXT NOT NULL REFERENCES taxonomy_domains(id),
  discipline TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

-- A knowledge point may appear in multiple sections (cross-book reuse)
CREATE TABLE IF NOT EXISTS section_knowledge (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(section_id, knowledge_id)
);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  knowledge_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY(knowledge_id, tag)
);

-- =============================================
-- 4) Graph edges (semantic relations)
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL REFERENCES relation_types(type),
  domain TEXT,
  reason TEXT,
  reason_zh TEXT,
  reason_en TEXT,
  weight REAL,
  confidence REAL DEFAULT 1.0,
  review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved', 'pending', 'rejected')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_id, relation_type, target_id)
);

-- =============================================
-- 5) Provenance links (tooltip/detail only)
-- =============================================

CREATE TABLE IF NOT EXISTS provenance_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  provenance_type TEXT NOT NULL REFERENCES relation_types(type),
  book_id TEXT,
  chapter_id TEXT,
  section_id TEXT,
  book_title TEXT,
  chapter_title TEXT,
  section_title TEXT,
  book_title_zh TEXT,
  book_title_en TEXT,
  chapter_title_zh TEXT,
  chapter_title_en TEXT,
  section_title_zh TEXT,
  section_title_en TEXT,
  link TEXT,
  UNIQUE(knowledge_id, provenance_type, book_id, chapter_id, section_id, link)
);

-- =============================================
-- 6) Ingestion queue for automation pipeline
-- =============================================

CREATE TABLE IF NOT EXISTS ingest_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  title TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'normalized', 'linked', 'pending_review', 'done', 'failed')),
  message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

-- =============================================
-- 7) Global settings + import run history
-- =============================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_version TEXT,
  relation_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  message TEXT,
  stats_json TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_json TEXT NOT NULL,
  relation_types_json TEXT,
  imported_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- 8) Helpful indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_sections_chapter_id ON sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_sk_knowledge_id ON section_knowledge(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_rel_source_target ON knowledge_relations(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON knowledge_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_prov_knowledge_id ON provenance_links(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_kn_domain_type ON knowledge_nodes(taxonomy_domain, knowledge_type);
CREATE INDEX IF NOT EXISTS idx_ingest_status ON ingest_queue(status);
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON source_import_runs(status);
CREATE INDEX IF NOT EXISTS idx_snapshot_created_at ON source_snapshots(created_at);

-- =============================================
-- 9) Read-model views for graph export
-- =============================================

CREATE VIEW IF NOT EXISTS v_book_graph_nodes AS
SELECT
  'book:' || b.id AS id,
  b.id AS raw_id,
  b.title AS title,
  b.title_zh AS title_zh,
  b.title_en AS title_en,
  'book' AS node_type,
  b.discipline AS discipline,
  b.taxonomy_domain AS taxonomy_domain,
  b.id AS book_id,
  NULL AS chapter_id,
  NULL AS section_id,
  NULL AS knowledge_type,
  NULL AS difficulty,
  NULL AS summary,
  NULL AS summary_zh,
  NULL AS summary_en
FROM books b
UNION ALL
SELECT
  'chapter:' || c.id AS id,
  c.id AS raw_id,
  c.title AS title,
  c.title_zh AS title_zh,
  c.title_en AS title_en,
  'chapter' AS node_type,
  b.discipline AS discipline,
  b.taxonomy_domain AS taxonomy_domain,
  b.id AS book_id,
  c.id AS chapter_id,
  NULL AS section_id,
  NULL AS knowledge_type,
  NULL AS difficulty,
  NULL AS summary,
  NULL AS summary_zh,
  NULL AS summary_en
FROM chapters c
JOIN books b ON b.id = c.book_id
UNION ALL
SELECT
  'section:' || s.id AS id,
  s.id AS raw_id,
  s.title AS title,
  s.title_zh AS title_zh,
  s.title_en AS title_en,
  'section' AS node_type,
  b.discipline AS discipline,
  b.taxonomy_domain AS taxonomy_domain,
  b.id AS book_id,
  c.id AS chapter_id,
  s.id AS section_id,
  NULL AS knowledge_type,
  NULL AS difficulty,
  NULL AS summary,
  NULL AS summary_zh,
  NULL AS summary_en
FROM sections s
JOIN chapters c ON c.id = s.chapter_id
JOIN books b ON b.id = c.book_id
UNION ALL
SELECT
  'knowledge:' || k.id AS id,
  k.id AS raw_id,
  k.title AS title,
  k.title_zh AS title_zh,
  k.title_en AS title_en,
  'knowledge' AS node_type,
  k.discipline AS discipline,
  k.taxonomy_domain AS taxonomy_domain,
  b.id AS book_id,
  c.id AS chapter_id,
  s.id AS section_id,
  k.knowledge_type AS knowledge_type,
  k.difficulty AS difficulty,
  k.summary AS summary,
  k.summary_zh AS summary_zh,
  k.summary_en AS summary_en
FROM section_knowledge sk
JOIN knowledge_nodes k ON k.id = sk.knowledge_id
JOIN sections s ON s.id = sk.section_id
JOIN chapters c ON c.id = s.chapter_id
JOIN books b ON b.id = c.book_id;

CREATE VIEW IF NOT EXISTS v_book_graph_edges AS
SELECT
  'book:' || b.id AS source,
  'chapter:' || c.id AS target,
  'has_chapter' AS edge_type,
  b.title || ' 包含章节 ' || c.title AS reason
FROM chapters c
JOIN books b ON b.id = c.book_id
UNION ALL
SELECT
  'chapter:' || c.id AS source,
  'section:' || s.id AS target,
  'has_section' AS edge_type,
  c.title || ' 包含小节 ' || s.title AS reason
FROM sections s
JOIN chapters c ON c.id = s.chapter_id
UNION ALL
SELECT
  'section:' || sk.section_id AS source,
  'knowledge:' || sk.knowledge_id AS target,
  'covers_knowledge' AS edge_type,
  'Section covers knowledge' AS reason
FROM section_knowledge sk;

CREATE VIEW IF NOT EXISTS v_knowledge_graph_nodes AS
SELECT
  k.id AS id,
  k.title AS title,
  k.title_zh AS title_zh,
  k.title_en AS title_en,
  k.summary AS summary,
  k.summary_zh AS summary_zh,
  k.summary_en AS summary_en,
  k.knowledge_type AS type,
  k.difficulty AS difficulty,
  k.discipline AS discipline,
  k.taxonomy_domain AS taxonomy_domain,
  k.status AS status
FROM knowledge_nodes k
WHERE k.status = 'active';

CREATE VIEW IF NOT EXISTS v_knowledge_graph_edges AS
SELECT
  r.source_id AS source,
  r.target_id AS target,
  r.relation_type AS edge_type,
  r.domain AS domain,
  r.reason AS reason,
  r.reason_zh AS reason_zh,
  r.reason_en AS reason_en,
  r.weight AS weight,
  r.confidence AS confidence,
  r.review_status AS review_status
FROM knowledge_relations r
WHERE r.review_status = 'approved';

CREATE VIEW IF NOT EXISTS v_knowledge_provenance AS
SELECT
  p.knowledge_id,
  p.provenance_type,
  p.book_id,
  p.chapter_id,
  p.section_id,
  p.book_title,
  p.chapter_title,
  p.section_title,
  p.book_title_zh,
  p.book_title_en,
  p.chapter_title_zh,
  p.chapter_title_en,
  p.section_title_zh,
  p.section_title_en,
  p.link
FROM provenance_links p;

-- =============================================
-- 10) Seed required taxonomy domains (aligned with knowledge index)
-- =============================================

INSERT OR IGNORE INTO taxonomy_domains (id, name_zh, name_en) VALUES
  ('philosophy', '哲学', 'Philosophy'),
  ('mathematics', '数学', 'Mathematics'),
  ('physics', '物理', 'Physics'),
  ('economics', '经济学', 'Economics'),
  ('neuroscience', '神经科学', 'Neuroscience'),
  ('psychology', '心理学', 'Psychology'),
  ('computer-science', '计算机', 'Computer Science'),
  ('control-theory-cybernetics', '控制理论', 'Control Theory & Cybernetics'),
  ('linguistics', '语言学', 'Linguistics'),
  ('artificial-intelligence', '人工智能', 'Artificial Intelligence');

INSERT OR IGNORE INTO app_settings (key, value, value_type) VALUES
  ('graph.tuning.nodeSizeScale', '1', 'number'),
  ('graph.tuning.degreeGain', '3', 'number'),
  ('graph.tuning.edgeWidthScale', '1', 'number'),
  ('graph.tuning.levelSeparation', '120', 'number'),
  ('graph.tuning.nodeSpacing', '170', 'number'),
  ('graph.tuning.physicsIterations', '180', 'number');
