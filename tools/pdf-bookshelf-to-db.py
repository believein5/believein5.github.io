from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader

logging.getLogger("pypdf").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "db" / "schema.sql"
DEFAULT_DB_PATH = ROOT / "db" / "graph.db"
DEFAULT_BOOKSHELF = ROOT / "BookShelf"
IMPORT_SOURCE_SQL = ROOT / "db" / "import-source.sql"

DOMAIN_RULES = [
    (re.compile(r"artificial intelligence|\bai\b", re.I), "artificial-intelligence", "computer-science"),
    (re.compile(r"math|algebra|calculus|analysis", re.I), "mathematics", "mathematics"),
    (re.compile(r"physics|mechanics|electromagnet", re.I), "physics", "physics"),
]

AIMA_CHAPTER_TITLES = {
    1: "Introduction",
    2: "Intelligent Agents",
    3: "Solving Problems by Searching",
    4: "Search in Complex Environments",
    5: "Adversarial Search and Games",
    6: "Constraint Satisfaction Problems",
    7: "Logical Agents",
    8: "First-Order Logic",
    9: "Inference in First-Order Logic",
    10: "Knowledge Representation",
    11: "Automated Planning",
    12: "Quantifying Uncertainty",
    13: "Probabilistic Reasoning",
    14: "Probabilistic Reasoning over Time",
    15: "Probabilistic Programming",
    16: "Making Simple Decisions",
    17: "Making Complex Decisions",
    18: "Multiagent Decision Making",
    19: "Learning from Examples",
    20: "Learning Probabilistic Models",
    21: "Deep Learning",
    22: "Reinforcement Learning",
    23: "Natural Language Processing",
    24: "Deep Learning for Natural Language Processing",
    25: "Computer Vision",
    26: "Robotics",
    27: "Philosophy, Ethics, and Safety of AI",
    28: "The Future of AI",
}


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower())
    return re.sub(r"-+", "-", s).strip("-") or "book"


def infer_domain_and_discipline(name: str) -> tuple[str, str]:
    for pattern, domain, discipline in DOMAIN_RULES:
        if pattern.search(name):
            return domain, discipline
    return "computer-science", "computer-science"


def execute_sql_file(conn: sqlite3.Connection, path: Path) -> None:
    if not path.exists():
        return
    conn.executescript(path.read_text(encoding="utf-8"))


def extract_toc_candidates(pdf_path: Path, max_pages: int = 120) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    lines: list[str] = []
    page_count = min(len(reader.pages), max_pages)
    for i in range(page_count):
        try:
            text = reader.pages[i].extract_text() or ""
        except Exception:
            continue
        for line in text.splitlines():
            cleaned = re.sub(r"\s+", " ", line).strip()
            if cleaned:
                lines.append(cleaned)

    chapter_pattern = re.compile(r"^(\d{1,2})\s+(.{3,120}?)\s+(\d{1,4})$")
    section_pattern = re.compile(r"^(\d{1,2})\.(\d{1,2})\s+(.{3,120}?)\s+(\d{1,4})$")

    chapters: dict[int, dict] = {}
    sections: list[dict] = []

    for line in lines:
        m2 = section_pattern.match(line)
        if m2:
            ch_no = int(m2.group(1))
            sec_no = int(m2.group(2))
            title = m2.group(3).strip(" .")
            page_no = int(m2.group(4))
            if 1 <= ch_no <= 99 and 1 <= sec_no <= 99:
                sections.append({
                    "chapter": ch_no,
                    "sec": sec_no,
                    "title": title,
                    "page": page_no,
                })
            continue

        m = chapter_pattern.match(line)
        if m:
            ch_no = int(m.group(1))
            title = m.group(2).strip(" .")
            page_no = int(m.group(3))
            if 1 <= ch_no <= 99 and len(title) >= 3:
                chapters.setdefault(ch_no, {"no": ch_no, "title": title, "page": page_no})

    chapter_list = [chapters[k] for k in sorted(chapters.keys())]

    if pdf_path.stem.lower() == "artificial intelligence a modern approach":
        manual_aima = [
            {"no": no, "title": title, "page": chapters.get(no, {}).get("page", 1)}
            for no, title in AIMA_CHAPTER_TITLES.items()
        ]
        if not chapter_list or min((item["no"] for item in chapter_list), default=99) > 1:
            chapter_list = manual_aima
        else:
            merged = {item["no"]: item for item in manual_aima}
            for parsed in chapter_list:
                merged[parsed["no"]] = {
                    "no": parsed["no"],
                    "title": merged.get(parsed["no"], {}).get("title", parsed["title"]),
                    "page": parsed["page"],
                }
            chapter_list = [merged[k] for k in sorted(merged.keys())]

    # Fallback when TOC can't be parsed from text
    if not chapter_list:
        chapter_list = [
            {"no": 1, "title": "Overview and Core Concepts", "page": 1},
            {"no": 2, "title": "Methods and Representations", "page": 2},
            {"no": 3, "title": "Applications and Practice", "page": 3},
        ]

    grouped_sections: dict[int, list[dict]] = {}
    for s in sections:
        grouped_sections.setdefault(s["chapter"], []).append(s)

    result = []
    for ch in chapter_list:
        sec_items = sorted(grouped_sections.get(ch["no"], []), key=lambda x: x["sec"])
        if not sec_items:
            sec_items = [{"chapter": ch["no"], "sec": 1, "title": f"{ch['title']} - Core Section", "page": ch["page"]}]
        result.append({
            "chapter_no": ch["no"],
            "chapter_title": ch["title"],
            "chapter_page": ch["page"],
            "sections": sec_items,
        })

    return result


def ensure_relation_types(conn: sqlite3.Connection) -> None:
    now_display = "tooltip-only"
    conn.execute(
        """
        INSERT OR IGNORE INTO relation_types
        (type, category, discipline, description, direction, transitive, symmetric, display_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("defined_in", "provenance", None, "Knowledge is formally defined in a source section.", "knowledge -> source", 0, 0, now_display),
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO relation_types
        (type, category, discipline, description, direction, transitive, symmetric, display_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("prerequisite_of", "common", None, "A is required before learning or applying B.", "A -> B", 1, 0, "graph"),
    )


def upsert_pdf_book(conn: sqlite3.Connection, pdf_path: Path) -> dict:
    book_name = pdf_path.stem
    slug = slugify(book_name)
    book_id = f"book-pdf-{slug}"
    domain, discipline = infer_domain_and_discipline(book_name)
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    toc = extract_toc_candidates(pdf_path)

    conn.execute(
        """
        INSERT INTO books (id, title, title_zh, title_en, discipline, taxonomy_domain, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          title_zh=excluded.title_zh,
          title_en=excluded.title_en,
          discipline=excluded.discipline,
          taxonomy_domain=excluded.taxonomy_domain,
          updated_at=excluded.updated_at
        """,
        (book_id, book_name, book_name, book_name, discipline, domain, now),
    )

    # Remove existing hierarchy + relations for this specific PDF book id scope
    conn.execute("DELETE FROM provenance_links WHERE book_id = ?", (book_id,))
    conn.execute("DELETE FROM knowledge_relations WHERE source_id LIKE ? OR target_id LIKE ?", (f"k-{book_id}-%", f"k-{book_id}-%"))
    conn.execute("DELETE FROM knowledge_tags WHERE knowledge_id LIKE ?", (f"k-{book_id}-%",))
    conn.execute("DELETE FROM section_knowledge WHERE knowledge_id LIKE ?", (f"k-{book_id}-%",))
    conn.execute("DELETE FROM knowledge_nodes WHERE id LIKE ?", (f"k-{book_id}-%",))
    conn.execute("DELETE FROM sections WHERE chapter_id LIKE ?", (f"{book_id}-ch-%",))
    conn.execute("DELETE FROM chapters WHERE book_id = ?", (book_id,))

    chapter_knowledge_ids: list[str] = []

    for c_ord, ch in enumerate(toc, start=1):
        chapter_no = ch["chapter_no"]
        chapter_title = ch["chapter_title"]
        chapter_id = f"{book_id}-ch-{chapter_no:02d}"

        conn.execute(
            """
            INSERT INTO chapters (id, book_id, title, title_zh, title_en, ord)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (chapter_id, book_id, chapter_title, chapter_title, chapter_title, c_ord),
        )

        # Core chapter knowledge node
        chapter_kn_id = f"k-{book_id}-ch-{chapter_no:02d}-core"
        chapter_knowledge_ids.append(chapter_kn_id)
        conn.execute(
            """
            INSERT INTO knowledge_nodes
            (id, title, title_zh, title_en, summary, summary_zh, summary_en, knowledge_type, difficulty, taxonomy_domain, discipline, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """,
            (
                chapter_kn_id,
                chapter_title,
                chapter_title,
                chapter_title,
                f"Core ideas from chapter {chapter_no}: {chapter_title}",
                f"Core ideas from chapter {chapter_no}: {chapter_title}",
                f"Core ideas from chapter {chapter_no}: {chapter_title}",
                "concept",
                "intermediate",
                domain,
                discipline,
                now,
            ),
        )
        conn.execute("INSERT OR IGNORE INTO knowledge_tags (knowledge_id, tag) VALUES (?, ?)", (chapter_kn_id, "pdf-import"))
        conn.execute("INSERT OR IGNORE INTO knowledge_tags (knowledge_id, tag) VALUES (?, ?)", (chapter_kn_id, "bookshelf"))

        for s_ord, sec in enumerate(ch["sections"], start=1):
            section_id = f"{chapter_id}-sec-{s_ord:02d}"
            section_title = sec["title"]
            conn.execute(
                """
                INSERT INTO sections (id, chapter_id, title, title_zh, title_en, ord)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (section_id, chapter_id, section_title, section_title, section_title, s_ord),
            )

            # map core chapter knowledge to first section; per-section nodes for full graph coverage
            if s_ord == 1:
                conn.execute(
                    "INSERT OR REPLACE INTO section_knowledge (section_id, knowledge_id, ord) VALUES (?, ?, 1)",
                    (section_id, chapter_kn_id),
                )

            sec_kn_id = f"k-{book_id}-ch-{chapter_no:02d}-sec-{s_ord:02d}"
            conn.execute(
                """
                INSERT INTO knowledge_nodes
                (id, title, title_zh, title_en, summary, summary_zh, summary_en, knowledge_type, difficulty, taxonomy_domain, discipline, status, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
                """,
                (
                    sec_kn_id,
                    section_title,
                    section_title,
                    section_title,
                    f"Section-level concept from {chapter_title}: {section_title}",
                    f"Section-level concept from {chapter_title}: {section_title}",
                    f"Section-level concept from {chapter_title}: {section_title}",
                    "concept",
                    "intermediate",
                    domain,
                    discipline,
                    now,
                ),
            )
            conn.execute("INSERT OR REPLACE INTO section_knowledge (section_id, knowledge_id, ord) VALUES (?, ?, ?)", (section_id, sec_kn_id, 2))
            conn.execute("INSERT OR IGNORE INTO knowledge_tags (knowledge_id, tag) VALUES (?, ?)", (sec_kn_id, "pdf-import"))
            conn.execute("INSERT OR IGNORE INTO knowledge_tags (knowledge_id, tag) VALUES (?, ?)", (sec_kn_id, "bookshelf"))

            conn.execute(
                """
                INSERT OR IGNORE INTO provenance_links
                (knowledge_id, provenance_type, book_id, chapter_id, section_id, book_title, chapter_title, section_title,
                 book_title_zh, book_title_en, chapter_title_zh, chapter_title_en, section_title_zh, section_title_en, link)
                VALUES (?, 'defined_in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sec_kn_id,
                    book_id,
                    chapter_id,
                    section_id,
                    book_name,
                    chapter_title,
                    section_title,
                    book_name,
                    book_name,
                    chapter_title,
                    chapter_title,
                    section_title,
                    section_title,
                    pdf_path.as_posix(),
                ),
            )

    # chain chapter-level prerequisites
    for prev_id, next_id in zip(chapter_knowledge_ids, chapter_knowledge_ids[1:]):
        conn.execute(
            """
            INSERT OR IGNORE INTO knowledge_relations
            (source_id, target_id, relation_type, domain, reason, reason_zh, reason_en, weight, confidence, review_status)
            VALUES (?, ?, 'prerequisite_of', ?, ?, ?, ?, 1.0, 0.92, 'approved')
            """,
            (
                prev_id,
                next_id,
                domain,
                "chapter sequence prerequisite",
                "chapter sequence prerequisite",
                "chapter sequence prerequisite",
            ),
        )

    return {
        "bookId": book_id,
        "title": book_name,
        "domain": domain,
        "discipline": discipline,
        "chapters": len(toc),
        "sections": sum(len(ch["sections"]) for ch in toc),
    }


def list_pdfs(folder: Path) -> Iterable[Path]:
    return sorted(p for p in folder.glob("*.pdf") if p.is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description="Import BookShelf PDFs into DB-first schema")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--bookshelf", type=Path, default=DEFAULT_BOOKSHELF)
    parser.add_argument("--migrate-source", action="store_true", help="Apply db/import-source.sql before PDF import")
    args = parser.parse_args()

    args.db.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON;")

    execute_sql_file(conn, SCHEMA_PATH)
    if args.migrate_source and IMPORT_SOURCE_SQL.exists():
        execute_sql_file(conn, IMPORT_SOURCE_SQL)

    ensure_relation_types(conn)

    pdfs = list(list_pdfs(args.bookshelf))
    summaries = []
    for pdf in pdfs:
        summaries.append(upsert_pdf_book(conn, pdf))

    conn.commit()
    conn.close()

    print(json.dumps({
        "db": str(args.db),
        "pdfCount": len(pdfs),
        "books": summaries,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
