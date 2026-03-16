# Graph Inbox (模板化输入)

把你新增的知识包放到这个目录，运行导入脚本后会自动合并进 `graph/knowledge-graph.json`。

## 1) 输入文件规则

- 文件格式：`*.json`
- 放置目录：`graph/inbox/`
- 约定：
  - 以 `_` 开头的文件会被忽略（比如模板文件）
  - 导入成功后，文件会被移动到 `graph/inbox/processed/`

## 2) 推荐流程

1. 复制 `_template.reading-pack.json`
2. 重命名为例如：`2026-03-16-aima-1.1.2.json`
3. 填写 `knowledgeNodes` / `sourceNodes` / `edges`
4. 在项目根目录运行：
   - `node tools/ingest-graph-templates.mjs`

## 3) 字段结构

### knowledgeNodes[]

最少建议填写：

- `id`（唯一）
- `title`
- `summary`
- `type`（如 `concept`）
- `tags`
- `retrievalKeywords`

脚本会自动补默认字段（如 `difficulty`、`commonErrors` 等）。

### sourceNodes[]

来源实体建议填写：

- `id`（唯一）
- `title`
- `summary`
- `sourceType`（book / book-section / paper / article）
- `locator`（例如 Chapter 1, Section 1.1.2）

### edges[]

每条边必须有：

- `source`
- `target`
- `type`
- `reason`

方案 B 的关键边：

- `defined_in`
- `supported_by`
- `cited_from`

## 4) 自动行为

导入脚本会：

- 按 `id` 对节点做 upsert（存在即更新，不存在即新增）
- 按 `(source,type,target)` 对边做 upsert
- 自动更新 `meta.updatedAt`
- 自动把版本号 patch +1（例如 `0.2.0 -> 0.2.1`）
