const GraphWorkspace = (() => {
  const state = {
    graphData: null,
    network: null,
    mode: 'book',
    selectedNodeId: null,
    search: '',
    localDepth: 0,
    queryResultIds: new Set(),
    nodeTypeFilters: new Set(),
    edgeTypeFilters: new Set(),
    collapsedBookNodes: new Set(),
    lang: document.documentElement.lang?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  };

  const EL = {};

  const UI = {
    zh: {
      bookMode: '书籍模式',
      knowledgeMode: '知识模式',
      clickNode: '点击任意节点查看详情。',
      incoming: '入边关系',
      outgoing: '出边关系',
      noData: '无',
      provenance: '来源关系（tooltip-only）',
      noProvenance: '暂无来源链接',
      tooltipProvenance: '来源关系',
      tooltipReason: '说明',
      tooltipDiscipline: '学科',
      queryReady: '已就绪',
      queryBookPaused: '书籍模式下查询暂停',
      queryNeedKnowledge: '请切换到知识模式后再运行查询',
      qMissingDefined: '缺少 defined_in 来源的节点',
      qWeakSupport: 'support 来源较弱的节点',
      qTopDegree: '连接度最高的知识节点',
      qCleared: '查询已清空',
      rendererFail: '图渲染器加载失败，请检查网络资源。',
      dataFail: '图谱数据加载失败。'
    },
    en: {
      bookMode: 'Book Hierarchy',
      knowledgeMode: 'Knowledge Network',
      clickNode: 'Click any node to inspect details.',
      incoming: 'Incoming relations',
      outgoing: 'Outgoing relations',
      noData: 'None',
      provenance: 'Provenance links (tooltip-only)',
      noProvenance: 'No provenance links',
      tooltipProvenance: 'Provenance',
      tooltipReason: 'Reason',
      tooltipDiscipline: 'Discipline',
      queryReady: 'Ready',
      queryBookPaused: 'Book Hierarchy active (queries paused)',
      queryNeedKnowledge: 'Switch to Knowledge Network to run queries',
      qMissingDefined: 'Nodes missing defined_in provenance',
      qWeakSupport: 'Nodes with weak support provenance',
      qTopDegree: 'Top degree knowledge nodes',
      qCleared: 'Query cleared',
      rendererFail: 'Graph renderer failed to load. Please check CDN resources.',
      dataFail: 'Unable to load graph data.'
    }
  };

  const NODE_I18N = {
    'book-math-analysis': { zh: '数学分析导论', en: 'Introduction to Mathematical Analysis' },
    'book-physics-mechanics': { zh: '经典力学基础', en: 'Foundations of Classical Mechanics' },
    'book-cs-foundations': { zh: '计算机科学基础', en: 'Computer Science Foundations' },
    'book-ai-aima-4e': { zh: '人工智能：一种现代方法（第4版）', en: 'Artificial Intelligence: A Modern Approach (4th Edition)' },
    'book-frontend-foundations': { zh: '前端基础手册', en: 'Frontend Foundations Handbook' },

    'math-ch1': { zh: '极限与连续', en: 'Limits and Continuity' },
    'math-ch2': { zh: '线性代数与变换', en: 'Linear Algebra and Transformations' },
    'phy-ch1': { zh: '牛顿体系', en: 'Newtonian Framework' },
    'phy-ch2': { zh: '电磁与波动', en: 'Electromagnetism and Waves' },
    'cs-ch1': { zh: '算法分析', en: 'Algorithm Analysis' },
    'cs-ch2': { zh: '机器学习', en: 'Machine Learning' },
    'ai-ch1': { zh: '什么是人工智能', en: 'What Is AI?' },
    'fe-ch1': { zh: 'HTML + CSS 核心能力', en: 'HTML + CSS Core Skills' },
    'fe-ch2': { zh: '实践项目', en: 'Practice Projects' },

    'math-ch1-sec1': { zh: '1.1 极限定义与ε-δ思想', en: '1.1 Limit Definition and ε-δ Method' },
    'math-ch1-sec2': { zh: '1.2 导数与线性近似', en: '1.2 Derivatives and Linear Approximation' },
    'math-ch2-sec1': { zh: '2.1 线性变换与频域观点', en: '2.1 Linear Transformations and Frequency-domain View' },
    'phy-ch1-sec1': { zh: '1.1 受力与加速度', en: '1.1 Forces and Acceleration' },
    'phy-ch1-sec2': { zh: '1.2 碰撞与守恒', en: '1.2 Collision and Conservation' },
    'phy-ch2-sec1': { zh: '2.1 场与方程组', en: '2.1 Fields and Equation Systems' },
    'cs-ch1-sec1': { zh: '1.1 时间复杂度', en: '1.1 Time Complexity' },
    'cs-ch1-sec2': { zh: '1.2 分治策略', en: '1.2 Divide and Conquer' },
    'cs-ch2-sec1': { zh: '2.1 反向传播', en: '2.1 Backpropagation' },
    'cs-ch2-sec2': { zh: '2.2 卷积网络', en: '2.2 Convolutional Networks' },
    'ai-ch1-sec1-1': { zh: '1.1 什么是 AI？', en: '1.1 What Is AI?' },
    'ai-ch1-sec1-1-1': { zh: '1.1.1 行为像人：图灵测试', en: '1.1.1 Acting Humanly: The Turing Test' },
    'ai-ch1-sec1-1-2': { zh: '1.1.2 像人一样思考', en: '1.1.2 Thinking Humanly' },
    'ai-ch1-sec1-1-4': { zh: '1.1.4 理性地行动', en: '1.1.4 Acting Rationally' },
    'ai-ch1-sec1-1-5': { zh: '1.1.5 有益机器', en: '1.1.5 Beneficial Machines' },
    'fe-ch1-sec1': { zh: '1.1 语义结构', en: '1.1 Semantic Structure' },
    'fe-ch1-sec2': { zh: '1.2 Flex 布局', en: '1.2 Flex Layout' },
    'fe-ch1-sec3': { zh: '1.3 动画基础', en: '1.3 Animation Basics' },
    'fe-ch2-sec1': { zh: '2.1 画廊项目', en: '2.1 Gallery Project' },
    'fe-ch2-sec2': { zh: '2.2 摩天轮动画', en: '2.2 Ferris Wheel Animation' },

    'k-limit-definition': { zh: '函数极限定义', en: 'Definition of Function Limit' },
    'k-epsilon-delta-proof': { zh: 'ε-δ证明模板', en: 'ε-δ Proof Template' },
    'k-derivative-definition': { zh: '导数定义', en: 'Definition of Derivative' },
    'k-fourier-transform': { zh: '傅里叶变换', en: 'Fourier Transform' },
    'k-newton-second-law': { zh: '牛顿第二定律', en: 'Newton’s Second Law' },
    'k-momentum-conservation': { zh: '动量守恒', en: 'Conservation of Momentum' },
    'k-maxwell-equations': { zh: '麦克斯韦方程组', en: 'Maxwell Equations' },
    'k-big-o-notation': { zh: '大O记号', en: 'Big-O Notation' },
    'k-divide-and-conquer': { zh: '分治法', en: 'Divide and Conquer' },
    'k-backpropagation': { zh: '反向传播算法', en: 'Backpropagation Algorithm' },
    'k-convolutional-neural-network': { zh: '卷积神经网络', en: 'Convolutional Neural Network' },
    'ai-what-is-ai': { zh: '什么是人工智能？', en: 'What Is AI?' },
    'ai-turing-test': { zh: '图灵测试路径', en: 'Turing Test Approach' },
    'ai-cognitive-modeling': { zh: '认知建模路径', en: 'Thinking Humanly: Cognitive Modeling' },
    'ai-rational-agent': { zh: '理性智能体', en: 'Rational Agent' },
    'ai-value-alignment': { zh: '价值对齐问题', en: 'Value Alignment Problem' },
    'semantic-html': { zh: '语义化 HTML', en: 'Semantic HTML' },
    'css-flexbox': { zh: 'CSS 弹性布局', en: 'CSS Flexbox' },
    'css-animation': { zh: 'CSS 动画', en: 'CSS Animation' },
    'project-cat-photo-gallery': { zh: '猫咪图片画廊', en: 'Cat Photo Gallery' },
    'project-ferris-wheel': { zh: '摩天轮项目', en: 'Ferris Wheel' }
  };

  const DISCIPLINE_I18N = {
    mathematics: { zh: '数学', en: 'Mathematics' },
    physics: { zh: '物理', en: 'Physics' },
    'computer-science': { zh: '计算机', en: 'Computer Science' },
    common: { zh: '通用', en: 'Common' }
  };

  const EDGE_LABEL_I18N = {
    has_chapter: { zh: '包含章节', en: 'has_chapter' },
    has_section: { zh: '包含小节', en: 'has_section' },
    covers_knowledge: { zh: '涵盖知识', en: 'covers_knowledge' },
    prerequisite_of: { zh: '前置于', en: 'prerequisite_of' },
    proves: { zh: '证明', en: 'proves' },
    causes: { zh: '导致', en: 'causes' },
    analyzes: { zh: '分析', en: 'analyzes' },
    analyzed_by: { zh: '被分析', en: 'analyzed_by' },
    models: { zh: '建模支撑', en: 'models' },
    optimizes: { zh: '优化/训练', en: 'optimizes' },
    related_to: { zh: '相关', en: 'related_to' },
    implements: { zh: '实现', en: 'implements' },
    support: { zh: '支持来源', en: 'support' },
    cite_from: { zh: '引用来源', en: 'cite_from' },
    defined_in: { zh: '定义来源', en: 'defined_in' }
  };

  const TYPE_LABEL_I18N = {
    book: { zh: '书籍', en: 'book' },
    chapter: { zh: '章节', en: 'chapter' },
    section: { zh: '小节', en: 'section' },
    knowledge: { zh: '知识点', en: 'knowledge' },
    concept: { zh: '概念', en: 'concept' },
    method: { zh: '方法', en: 'method' },
    law: { zh: '定律', en: 'law' },
    theory: { zh: '理论', en: 'theory' },
    algorithm: { zh: '算法', en: 'algorithm' },
    model: { zh: '模型', en: 'model' }
  };

  function t(key) {
    return UI[state.lang]?.[key] ?? UI.en[key] ?? key;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function labelOf(map, key, fallback = '') {
    const pack = map?.[key];
    if (!pack) return fallback || key;
    return pack[state.lang] || pack.en || pack.zh || fallback || key;
  }

  function pickI18nText(value, fallback = '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const zh = String(value.zh ?? value.en ?? fallback ?? '').trim();
      const en = String(value.en ?? value.zh ?? fallback ?? '').trim();
      return state.lang === 'en' ? (en || zh || fallback) : (zh || en || fallback);
    }
    return String(value ?? fallback ?? '');
  }

  function nodeTitle(node) {
    return pickI18nText(
      node?.titleI18n,
      labelOf(NODE_I18N, node?.rawId || node?.id, node?.title || node?.id || '')
    );
  }

  function nodeSummary(node) {
    return pickI18nText(node?.summaryI18n, node?.summary || '');
  }

  function edgeLabel(type) {
    return labelOf(EDGE_LABEL_I18N, type, type);
  }

  function edgeReason(edge) {
    return pickI18nText(edge?.reasonI18n, edge?.reason || '');
  }

  function typeLabel(type) {
    return labelOf(TYPE_LABEL_I18N, type, type);
  }

  function disciplineLabel(key) {
    return labelOf(DISCIPLINE_I18N, key, key || '');
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function getCurrentView() {
    return state.mode === 'book' ? state.graphData?.views?.book : state.graphData?.views?.knowledge;
  }

  function getNodeMap() {
    const view = getCurrentView();
    return new Map((view?.nodes || []).map((n) => [n.id, n]));
  }

  function nodeColorByType(node) {
    const type = node?.type || 'unknown';
    const knowledgeType = node?.knowledgeType || node?.type;
    if (type === 'book') return '#0ea5e9';
    if (type === 'chapter') return '#8b5cf6';
    if (type === 'section') return '#14b8a6';
    if (type === 'knowledge' || ['concept', 'method', 'law', 'theory', 'algorithm', 'model'].includes(type)) {
      switch (knowledgeType) {
        case 'law': return '#f97316';
        case 'theory': return '#7c3aed';
        case 'algorithm': return '#2563eb';
        case 'model': return '#0891b2';
        case 'method': return '#16a34a';
        default: return cssVar('--accent', '#2563eb');
      }
    }
    return '#64748b';
  }

  function nodeVisualByType(node) {
    const type = node?.type || 'unknown';
    const knowledgeType = node?.knowledgeType || node?.type;

    if (type === 'book') return { shape: 'box', borderWidth: 2.2, baseSize: 26, glyph: '▭' };
    if (type === 'chapter') return { shape: 'ellipse', borderWidth: 2, baseSize: 22, glyph: '◉' };
    if (type === 'section') return { shape: 'database', borderWidth: 1.9, baseSize: 20, glyph: '⬭' };

    if (type === 'knowledge' || ['concept', 'method', 'law', 'theory', 'algorithm', 'model'].includes(type)) {
      switch (knowledgeType) {
        case 'law': return { shape: 'triangle', borderWidth: 1.9, baseSize: 19, glyph: '▲' };
        case 'theory': return { shape: 'hexagon', borderWidth: 1.9, baseSize: 19, glyph: '⬢' };
        case 'algorithm': return { shape: 'diamond', borderWidth: 1.9, baseSize: 19, glyph: '◆' };
        case 'model': return { shape: 'star', borderWidth: 1.9, baseSize: 20, glyph: '★' };
        case 'method': return { shape: 'dot', borderWidth: 1.8, baseSize: 18, glyph: '●' };
        default: return { shape: 'dot', borderWidth: 1.8, baseSize: 18, glyph: '●' };
      }
    }

    return { shape: 'dot', borderWidth: 1.6, baseSize: 16, glyph: '•' };
  }

  function edgeColorByType(type) {
    const palette = {
      has_chapter: '#38bdf8',
      has_section: '#22d3ee',
      covers_knowledge: '#14b8a6',
      prerequisite_of: '#8b5cf6',
      proves: '#f97316',
      causes: '#ef4444',
      analyzes: '#0ea5e9',
      analyzed_by: '#06b6d4',
      models: '#a855f7',
      optimizes: '#2563eb',
      related_to: '#94a3b8'
    };
    return palette[type] || '#94a3b8';
  }

  function edgeVisualByType(type) {
    switch (type) {
      case 'has_chapter':
        return { width: 3.1, dashes: false, arrows: 'to', smooth: { type: 'continuous' }, glyph: '━━▶' };
      case 'has_section':
        return { width: 2.5, dashes: false, arrows: 'to', smooth: { type: 'continuous' }, glyph: '━▶' };
      case 'covers_knowledge':
        return { width: 1.9, dashes: [6, 6], arrows: 'to', smooth: { type: 'continuous' }, glyph: '┅▶' };
      case 'prerequisite_of':
        return { width: 2.6, dashes: false, arrows: 'to', smooth: { type: 'curvedCW', roundness: 0.1 }, glyph: '→' };
      case 'proves':
        return { width: 2.7, dashes: [2, 4], arrows: 'to', smooth: { type: 'curvedCW', roundness: 0.12 }, glyph: '⟹' };
      case 'causes':
        return { width: 2.9, dashes: false, arrows: 'to', smooth: { type: 'curvedCW', roundness: 0.14 }, glyph: '⇢' };
      case 'analyzes':
      case 'analyzed_by':
        return { width: 2.2, dashes: [10, 5], arrows: 'to', smooth: { type: 'dynamic' }, glyph: '↝' };
      case 'models':
        return { width: 2.4, dashes: [12, 6], arrows: 'to', smooth: { type: 'dynamic' }, glyph: '⇥' };
      case 'optimizes':
      case 'implements':
        return { width: 2.4, dashes: [4, 4], arrows: 'to', smooth: { type: 'dynamic' }, glyph: '↦' };
      case 'related_to':
        return { width: 1.8, dashes: [4, 10], arrows: '', smooth: { type: 'curvedCCW', roundness: 0.08 }, glyph: '⋯' };
      default:
        return { width: 1.8, dashes: false, arrows: 'to', smooth: { type: 'dynamic' }, glyph: '→' };
    }
  }

  function matchesSearch(node) {
    if (!state.search.trim()) return true;
    const q = state.search.trim().toLowerCase();
    const content = [
      node.id,
      node.rawId,
      nodeTitle(node),
      nodeSummary(node),
      node.discipline,
      ...(node.tags || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return content.includes(q);
  }

  function computeLocalGraph(baseNodeIds, edges) {
    if (state.mode !== 'knowledge') return baseNodeIds;
    if (!state.selectedNodeId || state.localDepth <= 0 || !baseNodeIds.has(state.selectedNodeId)) return baseNodeIds;

    const adjacency = new Map();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    }

    const visited = new Set([state.selectedNodeId]);
    let frontier = new Set([state.selectedNodeId]);

    for (let depth = 0; depth < state.localDepth; depth += 1) {
      const next = new Set();
      for (const current of frontier) {
        for (const neighbor of adjacency.get(current) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            next.add(neighbor);
          }
        }
      }
      frontier = next;
      if (frontier.size === 0) break;
    }

    return visited;
  }

  function getHiddenByCollapse(edges) {
    if (state.mode !== 'book' || state.collapsedBookNodes.size === 0) return new Set();

    const childrenMap = new Map();
    for (const edge of edges) {
      if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, new Set());
      childrenMap.get(edge.source).add(edge.target);
    }

    const hidden = new Set();
    for (const root of state.collapsedBookNodes) {
      const stack = [...(childrenMap.get(root) || [])];
      while (stack.length) {
        const current = stack.pop();
        if (hidden.has(current)) continue;
        hidden.add(current);
        for (const child of childrenMap.get(current) || []) {
          stack.push(child);
        }
      }
    }
    return hidden;
  }

  function getFilteredNodeIds(view) {
    const ids = new Set(
      (view?.nodes || [])
        .filter((node) => state.nodeTypeFilters.has(node.type))
        .filter(matchesSearch)
        .map((node) => node.id)
    );

    if (state.mode === 'knowledge' && state.queryResultIds.size > 0) {
      return new Set([...ids].filter((id) => state.queryResultIds.has(id)));
    }

    return ids;
  }

  function buildKnowledgeTooltip(node) {
    const provenance = Array.isArray(node.provenanceLinks) ? node.provenanceLinks : [];
    const linksHtml = provenance.length
      ? provenance
          .map((p) => {
            const type = edgeLabel(p.type);
            const book = pickI18nText(
              p.bookTitleI18n,
              labelOf(NODE_I18N, p.bookId, p.bookTitle || p.bookId || '')
            );
            const chapter = pickI18nText(p.chapterI18n, p.chapter || '');
            const section = pickI18nText(p.sectionI18n, p.section || '');
            return `<li><strong>${escapeHtml(type)}</strong> · <a href="${escapeHtml(p.link || 'graph/source.json')}" target="_blank" rel="noopener">${escapeHtml(book)} › ${escapeHtml(chapter)} › ${escapeHtml(section)}</a></li>`;
          })
          .join('')
      : `<li>${t('noProvenance')}</li>`;

    return `
      <div class="graph-tooltip-card">
        <div class="graph-tooltip-title">${escapeHtml(nodeTitle(node))}</div>
        ${nodeSummary(node) ? `<div class="graph-tooltip-summary">${escapeHtml(nodeSummary(node))}</div>` : ''}
        <div class="graph-tooltip-meta">${t('tooltipDiscipline')}: ${escapeHtml(disciplineLabel(node.discipline || 'common'))}</div>
        <div class="graph-tooltip-subtitle">${t('tooltipProvenance')}</div>
        <ul class="graph-tooltip-list">${linksHtml}</ul>
      </div>
    `;
  }

  function buildBookTooltip(node) {
    return `
      <div class="graph-tooltip-card">
        <div class="graph-tooltip-title">${escapeHtml(nodeTitle(node))}</div>
        <div class="graph-tooltip-meta">${escapeHtml(typeLabel(node.type))}</div>
      </div>
    `;
  }

  function buildDatasets() {
    const view = getCurrentView();
    const nodeMap = getNodeMap();
    const baseNodeIds = getFilteredNodeIds(view);
    const baseEdges = (view?.edges || []).filter(
      (edge) => state.edgeTypeFilters.has(edge.type) && baseNodeIds.has(edge.source) && baseNodeIds.has(edge.target)
    );

    let visibleNodeIds = computeLocalGraph(baseNodeIds, baseEdges);

    if (state.mode === 'book') {
      const hidden = getHiddenByCollapse(baseEdges);
      visibleNodeIds = new Set([...visibleNodeIds].filter((id) => !hidden.has(id)));
    }

    const edges = baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    const nodes = [...visibleNodeIds].map((id) => {
      const node = nodeMap.get(id);
      const degree = edges.filter((edge) => edge.source === id || edge.target === id).length;
      const isSelected = state.selectedNodeId === id;
      const color = nodeColorByType(node);
      const visual = nodeVisualByType(node);
      const tooltip = state.mode === 'knowledge' ? buildKnowledgeTooltip(node) : buildBookTooltip(node);

      return {
        id,
        label: nodeTitle(node),
        title: tooltip,
        shape: visual.shape,
        size: Math.max(visual.baseSize || 16, (visual.baseSize || 16) + Math.log2(1 + degree) * 3),
        borderWidth: visual.borderWidth,
        color: {
          background: color,
          border: isSelected ? cssVar('--solid-bg', '#111827') : cssVar('--line', '#e4e4e7'),
          highlight: {
            background: color,
            border: cssVar('--accent', '#2563eb')
          }
        },
        font: {
          color: cssVar('--text', '#18181b'),
          face: 'Inter'
        }
      };
    });

    const visEdges = edges.map((edge) => ({
      ...edgeVisualByType(edge.type),
      id: `${edge.source}-${edge.type}-${edge.target}`,
      from: edge.source,
      to: edge.target,
      label: edgeLabel(edge.type),
      color: {
        color: edgeColorByType(edge.type),
        highlight: cssVar('--accent', '#2563eb')
      },
      font: {
        size: 10,
        color: cssVar('--muted', '#52525b')
      }
    }));

    return { nodes, edges: visEdges };
  }

  function getIncomingEdges(nodeId) {
    const view = getCurrentView();
    return (view?.edges || []).filter((edge) => edge.target === nodeId);
  }

  function getOutgoingEdges(nodeId) {
    const view = getCurrentView();
    return (view?.edges || []).filter((edge) => edge.source === nodeId);
  }

  function renderDetail() {
    if (!EL.detail) return;
    const nodeMap = getNodeMap();
    const node = nodeMap.get(state.selectedNodeId);

    if (!node) {
      EL.detail.innerHTML = `
        <h2>Node details</h2>
        <p class="muted">${state.mode === 'book' ? t('bookMode') : t('knowledgeMode')} · ${t('clickNode')}</p>
      `;
      return;
    }

    const incoming = getIncomingEdges(node.id);
    const outgoing = getOutgoingEdges(node.id);

    const relationList = (list, dir) => {
      if (!list.length) return `<li class="muted">${t('noData')}</li>`;
      return list
        .map((edge) => {
          const peerId = dir === 'out' ? edge.target : edge.source;
          const peer = nodeMap.get(peerId);
          return `<li><strong>${escapeHtml(nodeTitle(peer) || peerId)}</strong><span class="note-inline">${escapeHtml(edgeLabel(edge.type))}</span><p class="muted">${escapeHtml(edgeReason(edge))}</p></li>`;
        })
        .join('');
    };

    const provenance = (node.provenanceLinks || []).length
      ? node.provenanceLinks
          .map((p) => {
            const book = labelOf(NODE_I18N, p.bookId, p.bookTitle || p.bookId || '');
            const chapter = pickI18nText(p.chapterI18n, p.chapter || '');
            const section = pickI18nText(p.sectionI18n, p.section || '');
            const bookLabel = pickI18nText(p.bookTitleI18n, book);
            return `<li><strong>${escapeHtml(edgeLabel(p.type))}</strong> · <a class="inline-link" href="${escapeHtml(p.link || 'graph/source.json')}" target="_blank" rel="noopener">${escapeHtml(bookLabel)} › ${escapeHtml(chapter)} › ${escapeHtml(section)}</a></li>`;
          })
          .join('')
      : `<li class="muted">${t('noData')}</li>`;

    EL.detail.innerHTML = `
      <div class="detail-meta">
        <span class="badge">${escapeHtml(typeLabel(node.type))}</span>
        ${node.difficulty ? `<span class="badge">${escapeHtml(node.difficulty)}</span>` : ''}
        ${node.discipline ? `<span class="badge">${escapeHtml(disciplineLabel(node.discipline))}</span>` : ''}
      </div>
      <h2>${escapeHtml(nodeTitle(node))}</h2>
      <p>${escapeHtml(nodeSummary(node))}</p>
      <div class="detail-section">
        <h4>${t('outgoing')}</h4>
        <ul class="mini-list">${relationList(outgoing, 'out')}</ul>
      </div>
      <div class="detail-section">
        <h4>${t('incoming')}</h4>
        <ul class="mini-list">${relationList(incoming, 'in')}</ul>
      </div>
      ${state.mode === 'knowledge' ? `
      <div class="detail-section">
        <h4>${t('provenance')}</h4>
        <ul class="mini-list">${provenance}</ul>
      </div>` : ''}
    `;
  }

  function renderLegend() {
    if (!EL.legend) return;
    const view = getCurrentView();
    const types = [...new Set((view?.nodes || []).map((n) => n.type))].sort();
    const edgeTypes = [...new Set((view?.edges || []).map((e) => e.type))].sort();

    const nodeLegend = types
      .map((type) => {
        const sampleNode = (view?.nodes || []).find((n) => n.type === type) || { type };
        const color = nodeColorByType(sampleNode);
        const visual = nodeVisualByType(sampleNode);
        return `<span><i class="legend-dot" style="background:${color}"></i><span class="legend-glyph">${visual.glyph}</span> ${escapeHtml(typeLabel(type))}</span>`;
      })
      .join('');

    const edgeLegend = edgeTypes
      .map((type) => {
        const visual = edgeVisualByType(type);
        return `<span><span class="legend-glyph">${visual.glyph}</span> ${escapeHtml(edgeLabel(type))}</span>`;
      })
      .join('');

    EL.legend.innerHTML = `
      <div class="legend-section">
        <strong>${state.lang === 'zh' ? '节点形状' : 'Node shapes'}</strong>
        <div class="graph-legend-grid">${nodeLegend}</div>
      </div>
      <div class="legend-section">
        <strong>${state.lang === 'zh' ? '边线型' : 'Edge styles'}</strong>
        <div class="graph-legend-grid">${edgeLegend}</div>
      </div>
    `;
  }

  function getNetworkOptions() {
    const common = {
      autoResize: true,
      interaction: {
        hover: true,
        zoomView: true,
        dragView: true,
        navigationButtons: true
      },
      nodes: { borderWidth: 1.2 },
      edges: { smooth: { type: 'dynamic' } }
    };

    if (state.mode === 'book') {
      return {
        ...common,
        physics: { enabled: false },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'UD',
            levelSeparation: 120,
            nodeSpacing: 170,
            sortMethod: 'directed'
          }
        }
      };
    }

    return {
      ...common,
      physics: {
        enabled: true,
        stabilization: { iterations: 180 }
      }
    };
  }

  function syncNetworkSelection() {
    if (state.network && state.selectedNodeId) {
      state.network.selectNodes([state.selectedNodeId]);
      state.network.focus(state.selectedNodeId, { animation: { duration: 300 } });
    }
  }

  function renderNetwork() {
    if (!EL.canvas || !state.graphData) return;
    const datasets = buildDatasets();
    const options = getNetworkOptions();

    if (!state.network) {
      state.network = new vis.Network(
        EL.canvas,
        {
          nodes: new vis.DataSet(datasets.nodes),
          edges: new vis.DataSet(datasets.edges)
        },
        options
      );

      state.network.on('click', (params) => {
        const nodeId = params.nodes?.[0] || null;
        state.selectedNodeId = nodeId;

        if (state.mode === 'book' && nodeId) {
          const view = getCurrentView();
          const hasChild = (view?.edges || []).some((edge) => edge.source === nodeId);
          if (hasChild) {
            if (state.collapsedBookNodes.has(nodeId)) state.collapsedBookNodes.delete(nodeId);
            else state.collapsedBookNodes.add(nodeId);
            renderNetwork();
            return;
          }
        }

        renderDetail();
      });
    } else {
      state.network.setOptions(options);
      state.network.setData({
        nodes: new vis.DataSet(datasets.nodes),
        edges: new vis.DataSet(datasets.edges)
      });
    }

    renderDetail();
    syncNetworkSelection();
    renderLegend();
  }

  function resetFiltersForMode() {
    const view = getCurrentView();
    state.nodeTypeFilters = new Set((view?.nodes || []).map((n) => n.type));
    state.edgeTypeFilters = new Set((view?.edges || []).map((e) => e.type));
  }

  function renderTypeFilters() {
    const view = getCurrentView();
    const types = [...new Set((view?.nodes || []).map((n) => n.type))].sort();

    EL.nodeTypeFilters.innerHTML = types
      .map((type) => {
        const active = state.nodeTypeFilters.has(type) ? 'is-active' : '';
        return `<button class="filter-chip ${active}" type="button" data-node-type="${type}">${escapeHtml(typeLabel(type))}</button>`;
      })
      .join('');

    EL.nodeTypeFilters.querySelectorAll('[data-node-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.nodeType;
        if (state.nodeTypeFilters.has(type)) state.nodeTypeFilters.delete(type);
        else state.nodeTypeFilters.add(type);

        if (state.nodeTypeFilters.size === 0) {
          state.nodeTypeFilters = new Set(types);
        }

        renderTypeFilters();
        renderNetwork();
      });
    });
  }

  function renderEdgeFilters() {
    const view = getCurrentView();
    const edgeTypes = [...new Set((view?.edges || []).map((e) => e.type))].sort();

    EL.edgeTypeFilters.innerHTML = edgeTypes
      .map((type) => {
        const checked = state.edgeTypeFilters.has(type) ? 'checked' : '';
        return `
          <label class="graph-edge-option">
            <input type="checkbox" data-edge-type="${type}" ${checked}>
            <span>${escapeHtml(edgeLabel(type))}</span>
          </label>
        `;
      })
      .join('');

    EL.edgeTypeFilters.querySelectorAll('[data-edge-type]').forEach((input) => {
      input.addEventListener('change', () => {
        const type = input.dataset.edgeType;
        if (input.checked) state.edgeTypeFilters.add(type);
        else state.edgeTypeFilters.delete(type);
        renderNetwork();
      });
    });
  }

  function runQuery(kind) {
    const view = state.graphData?.views?.knowledge;
    const nodes = view?.nodes || [];
    const edges = view?.edges || [];

    if (kind === 'missing-defined') {
      const ids = new Set(
        nodes
          .filter((node) => !(node.provenanceLinks || []).some((p) => p.type === 'defined_in'))
          .map((node) => node.id)
      );
      return { title: t('qMissingDefined'), ids };
    }

    if (kind === 'weak-support') {
      const ids = new Set(
        nodes
          .filter((node) => (node.provenanceLinks || []).filter((p) => p.type === 'support').length < 1)
          .map((node) => node.id)
      );
      return { title: t('qWeakSupport'), ids };
    }

    if (kind === 'top-degree') {
      const degree = new Map(nodes.map((n) => [n.id, 0]));
      for (const edge of edges) {
        degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
        degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
      }
      const top = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { title: t('qTopDegree'), ids: new Set(top.map(([id]) => id)) };
    }

    return { title: t('qCleared'), ids: new Set() };
  }

  function renderQueryResults(title, ids) {
    const nodeMap = new Map((state.graphData?.views?.knowledge?.nodes || []).map((n) => [n.id, n]));
    if (!ids.size) {
      EL.queryResults.innerHTML = `<li class="muted">${title}</li>`;
      return;
    }

    EL.queryResults.innerHTML =
      `<li><strong>${title}</strong></li>` +
      [...ids]
        .map((id) => {
          const node = nodeMap.get(id);
          return `<li><button class="graph-query-node" type="button" data-focus-node="${id}">${escapeHtml(nodeTitle(node) || id)}</button></li>`;
        })
        .join('');

    EL.queryResults.querySelectorAll('[data-focus-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mode = 'knowledge';
        state.selectedNodeId = btn.dataset.focusNode;
        state.localDepth = 1;
        EL.depth.value = '1';
        EL.depthLabel.textContent = '1';
        state.queryResultIds = ids;
        refreshModeUI();
      });
    });
  }

  function refreshModeUI() {
    if (EL.modeSwitch) {
      EL.modeSwitch.querySelectorAll('[data-graph-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.graphMode === state.mode);
      });
    }

    state.queryResultIds = state.mode === 'knowledge' ? state.queryResultIds : new Set();
    resetFiltersForMode();
    renderTypeFilters();
    renderEdgeFilters();
    renderNetwork();

    if (state.mode !== 'knowledge') {
      renderQueryResults(t('queryBookPaused'), new Set());
    }
  }

  function bindControls() {
    EL.search.addEventListener('input', () => {
      state.search = EL.search.value;
      renderNetwork();
    });

    EL.depth.addEventListener('input', () => {
      state.localDepth = Number(EL.depth.value);
      EL.depthLabel.textContent = String(state.localDepth);
      renderNetwork();
    });

    EL.modeSwitch?.querySelectorAll('[data-graph-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.dataset.graphMode;
        if (nextMode === state.mode) return;
        state.mode = nextMode;
        state.selectedNodeId = null;
        refreshModeUI();
      });
    });

    document.querySelectorAll('[data-query]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.mode !== 'knowledge') {
          renderQueryResults(t('queryNeedKnowledge'), new Set());
          return;
        }
        const kind = btn.dataset.query;
        const { title, ids } = runQuery(kind);
        state.queryResultIds = ids;
        renderQueryResults(title, ids);
        renderNetwork();
      });
    });
  }

  function cacheElements() {
    EL.canvas = document.querySelector('[data-graph-canvas]');
    EL.detail = document.querySelector('[data-graph-detail]');
    EL.search = document.querySelector('[data-graph-search]');
    EL.depth = document.querySelector('[data-graph-depth]');
    EL.depthLabel = document.querySelector('[data-graph-depth-label]');
    EL.nodeTypeFilters = document.querySelector('[data-node-type-filters]');
    EL.edgeTypeFilters = document.querySelector('[data-edge-type-filters]');
    EL.queryResults = document.querySelector('[data-query-results]');
    EL.modeSwitch = document.querySelector('[data-graph-mode-switch]');
    EL.legend = document.querySelector('[data-graph-legend]');
  }

  async function loadGraph() {
    const response = await fetch('graph/knowledge-graph.json');
    if (!response.ok) {
      throw new Error(`Failed to load graph data: ${response.status}`);
    }
    return response.json();
  }

  async function init() {
    if (document.body.dataset.page !== 'graph') return;
    cacheElements();

    if (typeof vis === 'undefined') {
      if (EL.canvas) {
        EL.canvas.innerHTML = `<div class="empty-state">${t('rendererFail')}</div>`;
      }
      if (EL.detail) {
        EL.detail.innerHTML = `<h2>Node details</h2><p class="muted">Renderer unavailable (vis-network not loaded).</p>`;
      }
      return;
    }

    try {
      state.graphData = await loadGraph();
      state.localDepth = Number(EL.depth?.value || 0);
      resetFiltersForMode();
      bindControls();
      document.addEventListener('kg:languagechange', (event) => {
        const nextLang = event?.detail?.lang === 'en' ? 'en' : 'zh';
        if (nextLang === state.lang) return;
        state.lang = nextLang;
        refreshModeUI();
      });
      refreshModeUI();
      renderQueryResults(t('queryReady'), new Set());
    } catch (error) {
      console.error(error);
      if (EL.detail) {
        EL.detail.innerHTML = `<h2>Node details</h2><p class="muted">${t('dataFail')}</p>`;
      }
      if (EL.canvas) {
        EL.canvas.innerHTML = `<div class="empty-state">${t('dataFail')}</div>`;
      }
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', GraphWorkspace.init);
