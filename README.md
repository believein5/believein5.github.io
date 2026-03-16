# Knowledge Graph Workspace

一个静态网站工程：从前端练习页出发，逐步升级为可维护的**知识图谱工作台**。

## 快速导航

- `index.html`：主页
- `knowledge.html`：知识浏览页（按学科索引）
- `graph.html`：图谱工作台（Book Hierarchy / Knowledge Network 双模式）
- `projects.html`：项目页
- `contact.html`：联系页

## 核心目录结构

```text
Knowledge_Graph/
├─ graph/
│  ├─ source.json              # 主数据源（书/章/节/知识 + 关系）
│  ├─ relation-types.json      # 关系类型字典
│  ├─ knowledge-graph.json     # 生成产物（前端读取）
│  ├─ tuning-config.json       # 重要参数调试配置（可人工修改）
│  ├─ schema.json              # 图谱输出结构约束
│  └─ README.md                # graph 子系统说明
├─ scripts/
│  ├─ site.js                  # 站点公共交互（主题/语言/知识页）
│  └─ graph.js                 # 图谱渲染与查询逻辑
├─ styles/
│  └─ site.css                 # 站点公共样式 + graph 控件样式
├─ tools/
│  ├─ source-to-graph.mjs      # source -> knowledge-graph 生成脚本
│  ├─ migrate-source-i18n.mjs  # i18n 字段迁移
│  └─ ingest-graph-templates.mjs
├─ HTML-files/                 # 前端练习页面
├─ AI-GUIDANCE.md              # 给 AI/代理看的工程指导文档
└─ Guidance-and-tips.md        # 基础 HTML/CSS 学习笔记
```

## 重要信息整合与人工调试接口

### 1) 页面内调参接口（即时）

在 `graph.html` 左侧控制面板中，新增了“**重要参数调试**”，支持实时调节：

- `nodeSizeScale`（节点尺寸倍率）
- `degreeGain`（度数增益）
- `edgeWidthScale`（边宽倍率）
- `levelSeparation`（书籍模式层级间距）
- `nodeSpacing`（书籍模式节点间距）
- `physicsIterations`（知识模式物理迭代）

### 2) 文件级调参接口（持久）

可直接编辑 `graph/tuning-config.json`，页面初始化时会自动加载该配置。

> 建议：先在页面调出满意效果，再把数值回写到 `tuning-config.json` 固化。

## 图谱数据工作流（source-first）

1. 修改 `graph/source.json`
2. 需要新增关系语义时修改 `graph/relation-types.json`
3. 运行 `tools/source-to-graph.mjs` 生成 `graph/knowledge-graph.json`
4. 打开 `graph.html` 验证双模式渲染与查询结果

## AI 协作入口

- `AI-GUIDANCE.md`：给 AI 代理/协作者的最小必要规则（推荐先读）
- `graph/README.md`：图谱子系统设计说明

## 学习来源（原始背景）

- [freeCodeCamp](https://www.freecodecamp.org/learn/2022/responsive-web-design/)
- [黑马程序员课程](https://www.bilibili.com/video/BV14J4114768/)
