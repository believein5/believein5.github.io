from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT / "db" / "graph.db"
DEFAULT_OUTPUT = ROOT / "graph" / "knowledge-graph.json"


def as_i18n(zh: str | None, en: str | None, fallback: str = "") -> dict:
    z = (zh or en or fallback or "").strip()
    e = (en or zh or fallback or "").strip()
    return {"zh": z, "en": e}


def fetchall_dict(conn: sqlite3.Connection, sql: str, params: tuple = ()):
    cur = conn.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def build_relation_types(conn: sqlite3.Connection) -> dict:
    rels = fetchall_dict(conn, "SELECT * FROM relation_types ORDER BY category, discipline, type")

    provenance = []
    common = []
    discipline: dict[str, list] = {}

    for r in rels:
        item = {
            "type": r["type"],
            "description": r["description"] or "",
            "direction": r["direction"] or "",
        }
        if r["category"] == "provenance":
            item["display"] = r["display_scope"] or "tooltip-only"
            provenance.append(item)
        elif r["category"] == "common":
            item["transitive"] = bool(r.get("transitive", 0))
            item["symmetric"] = bool(r.get("symmetric", 0))
            common.append(item)
        else:
            key = r["discipline"] or "common"
            discipline.setdefault(key, []).append(item)

    return {
        "meta": {
            "title": "Knowledge Relation Taxonomy",
            "version": "db-1.0.0",
            "updatedAt": dt.date.today().isoformat(),
            "description": "Relation taxonomy loaded from database relation_types table.",
        },
        "provenanceRelations": provenance,
        "commonRelations": common,
        "disciplineRelations": discipline,
    }


def build_book_view(conn: sqlite3.Connection) -> dict:
    nodes_raw = fetchall_dict(conn, "SELECT * FROM v_book_graph_nodes")
    edges_raw = fetchall_dict(conn, "SELECT * FROM v_book_graph_edges")

    nodes = []
    for n in nodes_raw:
        node = {
            "id": n["id"],
            "rawId": n["raw_id"],
            "titleI18n": as_i18n(n.get("title_zh"), n.get("title_en"), n.get("title")),
            "title": n.get("title") or "",
            "type": n.get("node_type") or "",
            "discipline": n.get("discipline"),
            "taxonomyDomain": n.get("taxonomy_domain") or "computer-science",
        }
        if n.get("knowledge_type"):
            node["knowledgeType"] = n["knowledge_type"]
        if n.get("difficulty"):
            node["difficulty"] = n["difficulty"]
        if n.get("summary"):
            node["summary"] = n["summary"]
            node["summaryI18n"] = as_i18n(n.get("summary_zh"), n.get("summary_en"), n.get("summary"))
        if n.get("book_id"):
            node["bookId"] = n["book_id"]
        if n.get("chapter_id"):
            node["chapterId"] = n["chapter_id"]
        if n.get("section_id"):
            node["sectionId"] = n["section_id"]
        nodes.append(node)

    edges = [
        {
            "source": e["source"],
            "target": e["target"],
            "type": e["edge_type"],
            "reason": e.get("reason") or "",
            "reasonI18n": as_i18n(e.get("reason"), e.get("reason"), e.get("reason") or ""),
        }
        for e in edges_raw
    ]

    return {"nodes": nodes, "edges": edges}


def build_knowledge_view(conn: sqlite3.Connection) -> dict:
    nodes_raw = fetchall_dict(conn, "SELECT * FROM v_knowledge_graph_nodes")
    edges_raw = fetchall_dict(conn, "SELECT * FROM v_knowledge_graph_edges")
    tags_raw = fetchall_dict(conn, "SELECT knowledge_id, tag FROM knowledge_tags ORDER BY knowledge_id, tag")
    prov_raw = fetchall_dict(conn, "SELECT * FROM v_knowledge_provenance")

    tags_map: dict[str, list[str]] = {}
    for t in tags_raw:
        tags_map.setdefault(t["knowledge_id"], []).append(t["tag"])

    prov_map: dict[str, list[dict]] = {}
    for p in prov_raw:
        prov_map.setdefault(p["knowledge_id"], []).append(
            {
                "type": p["provenance_type"],
                "bookId": p.get("book_id"),
                "bookTitle": p.get("book_title") or p.get("book_id") or "",
                "bookTitleI18n": as_i18n(p.get("book_title_zh"), p.get("book_title_en"), p.get("book_title") or ""),
                "chapter": p.get("chapter_title") or p.get("chapter_id") or "",
                "chapterI18n": as_i18n(p.get("chapter_title_zh"), p.get("chapter_title_en"), p.get("chapter_title") or ""),
                "section": p.get("section_title") or p.get("section_id") or "",
                "sectionI18n": as_i18n(p.get("section_title_zh"), p.get("section_title_en"), p.get("section_title") or ""),
                "link": p.get("link") or "",
            }
        )

    nodes = []
    for n in nodes_raw:
        nid = n["id"]
        nodes.append(
            {
                "id": nid,
                "title": n.get("title") or nid,
                "titleI18n": as_i18n(n.get("title_zh"), n.get("title_en"), n.get("title") or nid),
                "summary": n.get("summary") or "",
                "summaryI18n": as_i18n(n.get("summary_zh"), n.get("summary_en"), n.get("summary") or ""),
                "type": n.get("type") or "concept",
                "knowledgeType": n.get("type") or "concept",
                "difficulty": n.get("difficulty") or "beginner",
                "discipline": n.get("discipline") or "computer-science",
                "taxonomyDomain": n.get("taxonomy_domain") or "computer-science",
                "tags": tags_map.get(nid, []),
                "provenanceLinks": prov_map.get(nid, []),
            }
        )

    edges = []
    for e in edges_raw:
        edges.append(
            {
                "source": e["source"],
                "target": e["target"],
                "type": e["edge_type"],
                "domain": e.get("domain") or "common",
                "reason": e.get("reason") or "",
                "reasonI18n": as_i18n(e.get("reason_zh"), e.get("reason_en"), e.get("reason") or ""),
                "weight": e.get("weight"),
                "confidence": e.get("confidence"),
            }
        )

    return {"nodes": nodes, "edges": edges}


def main() -> None:
    parser = argparse.ArgumentParser(description="Export graph/knowledge JSON from DB-first schema")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    relation_types = build_relation_types(conn)
    book_view = build_book_view(conn)
    knowledge_view = build_knowledge_view(conn)

    payload = {
        "meta": {
            "title": "Knowledge Graph Views",
            "version": "db-1.0.0",
            "updatedAt": dt.date.today().isoformat(),
            "description": "Generated from DB-first schema views.",
            "language": "zh-CN",
            "mode": "db-first",
        },
        "sourceRef": {
            "db": str(args.db.as_posix()),
            "source": "database",
        },
        "relationTypes": relation_types,
        "stats": {
            "books": len({n["rawId"] for n in book_view["nodes"] if n["type"] == "book"}),
            "knowledgeNodes": len(knowledge_view["nodes"]),
            "knowledgeEdgeTypes": sorted({e["type"] for e in knowledge_view["edges"]}),
            "knowledgeNodeTypes": sorted({n["type"] for n in knowledge_view["nodes"]}),
            "taxonomyDomains": sorted({n.get("taxonomyDomain", "") for n in knowledge_view["nodes"] if n.get("taxonomyDomain")}),
        },
        "views": {
            "book": book_view,
            "knowledge": knowledge_view,
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    conn.close()

    print(json.dumps({
        "db": str(args.db),
        "output": str(args.out),
        "bookNodes": len(book_view["nodes"]),
        "knowledgeNodes": len(knowledge_view["nodes"]),
        "knowledgeEdges": len(knowledge_view["edges"]),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
