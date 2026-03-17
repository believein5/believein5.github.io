# Knowledge Graph Workspace

一个静态网站 + 知识图谱工程，当前已统一为 **DB-only 运行模式**（DB 为唯一处理中心，source 仅归档输入）。

## 当前项目状态（2026-03）

- ✅ 图谱支持双模式：`Book Hierarchy` / `Knowledge Network`
- ✅ 学科分类已对齐 `knowledge` 页 10 个 taxonomy domain
- ✅ provenance（`defined_in` / `cite_from` / `support`）仅在 tooltip/detail 展示
- ✅ 图谱支持页面调参与配置文件调参
- ✅ `source.json -> db/import-source.sql` 自动生成链路已落地
- ✅ `BookShelf/*.pdf -> DB` 自动入库脚本已落地（含章节/小节推断）
- ✅ `DB -> graph/knowledge-graph.json` 导出脚本已落地（前端读取）

## 站点页面

- `index.html`：主页
- `knowledge.html`：知识浏览页（学科索引）
- `graph.html`：图谱工作台
- `projects.html`：项目页
- `contact.html`：联系页

## 核心目录（按职责）

```text
Knowledge_Graph/
├─ graph/
│  ├─ source.json              # 迁移期人工输入源（书/章/节/知识/关系）
│  ├─ relation-types.json      # 关系字典
│  ├─ knowledge-graph.json     # 前端图谱消费快照
│  ├─ tuning-config.json       # 图谱调参默认值
│  ├─ schema.json              # 图谱输出结构约束
│  └─ README.md
├─ db/
│  ├─ schema.sql               # DB-first 统一模型（表 + 视图 + 配置）
│  ├─ import-source.sql        # 由脚本生成的全量导入 SQL
│  └─ README.md
├─ tools/
│  ├─ db-to-graph.py           # DB -> knowledge-graph.json
│  ├─ pdf-bookshelf-to-db.py   # BookShelf PDF -> DB
│  ├─ source-to-db-sql.mjs     # source + relation-types -> import-source.sql
│  ├─ migrate-source-i18n.mjs
│  └─ ingest-graph-templates.mjs
├─ scripts/
│  ├─ site.js                  # 站点公共交互（主题/语言/顶栏折叠等）
│  └─ graph.js                 # 图谱渲染、筛选、查询、详情
├─ styles/site.css             # 站点与图谱样式
├─ AI-GUIDANCE.md              # AI 协作指导
└─ HTML-files/                 # 前端练习页面
```

## 数据架构（推荐认知）

### 运行态（当前）

- `db/schema.sql` + `db/graph.db`：统一数据模型与运行中枢（SSOT）
- `graph/knowledge-graph.json`：前端展示快照（由 DB 导出）

### 归档输入（可选）

- `graph/source.json`：仅用于归档/批量导入生成，不作为运行时主链

## 现有 Pipeline

### A) Source -> DB（归档导入链路，可选）

1. 修改 `graph/source.json` / `graph/relation-types.json`
2. 运行 `tools/source-to-db-sql.mjs`
3. 生成 `db/import-source.sql`
4. 将 SQL 应用到 SQLite 数据库

### B) BookShelf PDF -> DB（新增）

1. 将 PDF 放入 `BookShelf/`
2. 运行 `tools/pdf-bookshelf-to-db.py --db db/graph.db --bookshelf BookShelf --migrate-source`
3. 自动生成/更新书籍层次、章节小节、知识点占位、provenance、基础先修边

### C) DB -> Graph（推荐主链）

1. 运行 `tools/db-to-graph.py --db db/graph.db --out graph/knowledge-graph.json`
2. 前端页面直接消费最新 DB 导出快照

> `db/import-source.sql` 为生成文件，不建议手工编辑。

## 图谱调参与人工调试

### 即时调参（页面）

`graph.html` 左侧支持实时调节：

- `nodeSizeScale`
- `degreeGain`
- `edgeWidthScale`
- `levelSeparation`
- `nodeSpacing`
- `physicsIterations`

### 持久调参（配置）

编辑 `graph/tuning-config.json`（页面启动自动读取）。

## 导航折叠行为（最新）

- 顶栏仅折叠溢出按钮（不影响首行可见按钮）
- 折叠项通过箭头下方弹层展示
- 支持窗口变化、语言切换后自动重算

## 文档入口

- `AI-GUIDANCE.md`：AI 协作约束与建议
- `graph/README.md`：图谱子系统说明
- `db/README.md`：数据库模型与导入流程说明

## 当前实测结果（BookShelf）

- 已识别 PDF：`Artificial Intelligence A Modern Approach.pdf`
- 自动入库：1 本书 / 19 章 / 111 小节（由目录文本推断）
- DB 导出后图谱规模：bookNodes=316, knowledgeNodes=151, knowledgeEdges=36

> 注意：该 PDF 的 bookmark/outline 为 0，章节来自目录页文本规则提取；后续可继续优化抽取精度。

## 学习来源（原始背景）

- [freeCodeCamp](https://www.freecodecamp.org/learn/2022/responsive-web-design/)
- [黑马程序员课程](https://www.bilibili.com/video/BV14J4114768/)
