const GraphWorkspace = (() => {
  const DEFAULT_TUNING = {
    nodeSizeScale: 0.95,
    degreeGain: 2.6,
    edgeWidthScale: 1.1,
    levelSeparation: 150,
    nodeSpacing: 210,
    physicsIterations: 240
  };

  const state = {
    graphData: null,
    network: null,
    mode: 'knowledge',
    selectedNodeId: null,
    focusMode: 'neighbors',
    depthMode: 'undirected',
    search: '',
    localDepth: 0,
    queryResultIds: new Set(),
    nodeTypeFilters: new Set(),
    domainFilters: new Set(),
    highlightedDomains: new Set(),
    domainHighlightOnly: false,
    edgeTypeFilters: new Set(),
    collapsedBookNodes: new Set(),
    roadmapExpandedNodes: new Set(),
    tuning: { ...DEFAULT_TUNING },
    settingsDragged: false,
    shouldRefocus: false,
    pendingViewport: null,
    lang: document.documentElement.lang?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  };

  const EL = {};

  const UI = {
    zh: {
      bookMode: '书籍模式',
      knowledgeMode: '知识模式',
      roadmapMode: '学习路线模式',
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
      summary: '关系摘要',
      directUpstream: '直接前置数量',
      directDownstream: '直接后继数量',
      transitiveUpstream: '传递前置数量',
      transitiveDownstream: '传递后继数量',
      rendererFail: '图渲染器加载失败，请检查网络资源。',
      dataFail: '图谱数据加载失败。'
    },
    en: {
      bookMode: 'Book Hierarchy',
      knowledgeMode: 'Knowledge Network',
      roadmapMode: 'Roadmap',
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
      summary: 'Relation summary',
      directUpstream: 'Direct prerequisites',
      directDownstream: 'Direct dependents',
      transitiveUpstream: 'Transitive prerequisites',
      transitiveDownstream: 'Transitive dependents',
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
    philosophy: { zh: '哲学', en: 'Philosophy' },
    mathematics: { zh: '数学', en: 'Mathematics' },
    physics: { zh: '物理', en: 'Physics' },
    economics: { zh: '经济学', en: 'Economics' },
    neuroscience: { zh: '神经科学', en: 'Neuroscience' },
    psychology: { zh: '心理学', en: 'Psychology' },
    'computer-science': { zh: '计算机', en: 'Computer Science' },
    'control-theory-cybernetics': { zh: '控制理论与控制论', en: 'Control Theory & Cybernetics' },
    'robotics-engineering': { zh: '机器人工程', en: 'Robotics Engineering' },
    linguistics: { zh: '语言学', en: 'Linguistics' },
    'artificial-intelligence': { zh: '人工智能', en: 'Artificial Intelligence' },
    common: { zh: '通用', en: 'Common' }
  };

  const DISCIPLINE_COLORS = {
    philosophy: '#808080',
    mathematics: '#00ffff',
    physics: '#6040ff',
    economics: '#804000',
    neuroscience: '#ff00ff',
    psychology: '#ff8080',
    'computer-science': '#404080',
    'control-theory-cybernetics': '#00ff00',
    'robotics-engineering': '#008040',
    linguistics: '#8000ff',
    'artificial-intelligence': '#ff2040',
    common: '#404040'
  };

  const DISCIPLINE_DISPLAY_ORDER = [
    'artificial-intelligence',
    'philosophy',
    'mathematics',
    'physics',
    'economics',
    'neuroscience',
    'psychology',
    'computer-science',
    'control-theory-cybernetics',
    'robotics-engineering',
    'linguistics',
    'common'
  ];

  const THEME_RENDER_PRESETS = {
    light: {
      fadedNodeOpacity: 0.24,
      fadedEdgeOpacity: 0.2,
      nodeShadowColor: 'rgba(15, 23, 42, 0.14)',
      nodeShadowSize: 10,
      edgeShadowColor: 'rgba(37, 99, 235, 0.18)',
      edgeShadowSize: 6,
      selectedBorder: '#0f172a',
      focusBorder: '#2563eb',
      upstreamBorder: '#7c3aed',
      downstreamBorder: '#c2410c',
      bothBorder: '#b91c1c',
      edgeMutedColor: 'rgba(71, 85, 105, 0.42)',
      edgeFocusBoost: 1.55
    },
    dark: {
      fadedNodeOpacity: 0.3,
      fadedEdgeOpacity: 0.26,
      nodeShadowColor: 'rgba(96, 165, 250, 0.28)',
      nodeShadowSize: 12,
      edgeShadowColor: 'rgba(96, 165, 250, 0.32)',
      edgeShadowSize: 7,
      selectedBorder: '#f8fafc',
      focusBorder: '#93c5fd',
      upstreamBorder: '#c4b5fd',
      downstreamBorder: '#fdba74',
      bothBorder: '#fda4af',
      edgeMutedColor: 'rgba(148, 163, 184, 0.4)',
      edgeFocusBoost: 1.75
    }
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

  function tooltipElement(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper;
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
      node?.title || labelOf(NODE_I18N, node?.rawId || node?.id, node?.id || '')
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

  function resolveDomain(node) {
    return node?.taxonomyDomain || node?.discipline || 'common';
  }

  function disciplineColor(nodeOrDomain) {
    const domain = typeof nodeOrDomain === 'string' ? nodeOrDomain : resolveDomain(nodeOrDomain);
    return DISCIPLINE_COLORS[domain] || DISCIPLINE_COLORS.common;
  }

  function sortDomains(domains = []) {
    const rank = new Map(DISCIPLINE_DISPLAY_ORDER.map((key, index) => [key, index]));
    return [...domains].sort((a, b) => {
      const ra = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a).localeCompare(String(b));
    });
  }

  function currentRenderPreset() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return THEME_RENDER_PRESETS[theme];
  }

  function isKnowledgeNodeType(type = '') {
    return type === 'knowledge' || ['concept', 'method', 'law', 'theory', 'algorithm', 'model'].includes(type);
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function normalizeTuning(raw = {}) {
    const safeNumber = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };

    return {
      nodeSizeScale: safeNumber(raw.nodeSizeScale, DEFAULT_TUNING.nodeSizeScale, 0.6, 1.8),
      degreeGain: safeNumber(raw.degreeGain, DEFAULT_TUNING.degreeGain, 1, 6),
      edgeWidthScale: safeNumber(raw.edgeWidthScale, DEFAULT_TUNING.edgeWidthScale, 0.6, 2.4),
      levelSeparation: safeNumber(raw.levelSeparation, DEFAULT_TUNING.levelSeparation, 80, 220),
      nodeSpacing: safeNumber(raw.nodeSpacing, DEFAULT_TUNING.nodeSpacing, 120, 300),
      physicsIterations: safeNumber(raw.physicsIterations, DEFAULT_TUNING.physicsIterations, 80, 400)
    };
  }

  function setTuning(next) {
    state.tuning = normalizeTuning(next);
    syncTuningUI();
  }

  function syncTuningUI() {
    if (!EL.tuningInputs) return;

    EL.tuningInputs.forEach((input) => {
      const key = input.dataset.tuningKey;
      if (!key || !(key in state.tuning)) return;
      input.value = String(state.tuning[key]);
    });

    EL.tuningNumberInputs?.forEach((input) => {
      const key = input.dataset.tuningNumber;
      if (!key || !(key in state.tuning)) return;
      input.value = String(state.tuning[key]);
    });
  }

  function applyTuningValue(key, value) {
    if (!key || !(key in state.tuning)) return;
    state.tuning = normalizeTuning({ ...state.tuning, [key]: value });
    syncTuningUI();
    renderNetwork();
  }

  function getCurrentView() {
    return state.graphData?.views?.knowledge;
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
    if (type === 'section') return { shape: 'box', borderWidth: 1.7, baseSize: 15, glyph: '▢' };

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
      resolveDomain(node),
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

    const outgoing = new Map();
    const undirected = new Map();
    for (const edge of edges) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, new Set());
      outgoing.get(edge.source).add(edge.target);

      if (!undirected.has(edge.source)) undirected.set(edge.source, new Set());
      if (!undirected.has(edge.target)) undirected.set(edge.target, new Set());
      undirected.get(edge.source).add(edge.target);
      undirected.get(edge.target).add(edge.source);
    }

    const visited = new Set([state.selectedNodeId]);
    let frontier = new Set([state.selectedNodeId]);

    for (let depth = 0; depth < state.localDepth; depth += 1) {
      const next = new Set();
      for (const current of frontier) {
        const neighbors = state.depthMode === 'directed'
          ? (outgoing.get(current) || [])
          : (undirected.get(current) || []);

        for (const neighbor of neighbors) {
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

  function getFilteredNodeIds(view) {
    const ids = new Set(
      (view?.nodes || [])
        .filter((node) => state.nodeTypeFilters.has(node.type))
        .filter((node) => state.domainFilters.has(resolveDomain(node)))
        .filter(matchesSearch)
        .map((node) => node.id)
    );

    if (state.mode === 'knowledge' && state.queryResultIds.size > 0) {
      return new Set([...ids].filter((id) => state.queryResultIds.has(id)));
    }

    return ids;
  }

  function getFilteredBaseSubgraph(view = getCurrentView()) {
    const nodeIds = getFilteredNodeIds(view);
    const edges = (view?.edges || []).filter((edge) => {
      if (!state.edgeTypeFilters.has(edge.type)) return false;
      return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });
    return { nodeIds, edges };
  }

  function computeFocusContext(selectedId, baseNodeIds, edges) {
    const empty = {
      selected: selectedId,
      directNeighbors: new Set(),
      upstream: new Set(),
      downstream: new Set(),
      focusNodeIds: new Set(),
      directEdgeIds: new Set()
    };

    if (!selectedId || !baseNodeIds.has(selectedId)) return empty;

    const incomingMap = new Map();
    const outgoingMap = new Map();
    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
      outgoingMap.get(edge.source).push(edge.target);
      incomingMap.get(edge.target).push(edge.source);
    }

    const collectTransitive = (seed, map) => {
      const visited = new Set();
      const stack = [...(map.get(seed) || [])];
      while (stack.length) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        for (const next of map.get(id) || []) {
          if (!visited.has(next)) stack.push(next);
        }
      }
      return visited;
    };

    const directOutgoing = new Set(outgoingMap.get(selectedId) || []);
    const directIncoming = new Set(incomingMap.get(selectedId) || []);

    for (const id of directOutgoing) empty.directNeighbors.add(id);
    for (const id of directIncoming) empty.directNeighbors.add(id);

    empty.upstream = collectTransitive(selectedId, incomingMap);
    empty.downstream = collectTransitive(selectedId, outgoingMap);

    for (const edge of edges) {
      if (edge.source === selectedId || edge.target === selectedId) {
        empty.directEdgeIds.add(`${edge.source}-${edge.type}-${edge.target}`);
      }
    }

    const focusNodeIds = new Set([selectedId]);
    if (state.focusMode === 'neighbors' || state.focusMode === 'both') {
      for (const id of empty.directNeighbors) focusNodeIds.add(id);
    }
    if (state.focusMode === 'upstream' || state.focusMode === 'both') {
      for (const id of empty.upstream) focusNodeIds.add(id);
    }
    if (state.focusMode === 'downstream' || state.focusMode === 'both') {
      for (const id of empty.downstream) focusNodeIds.add(id);
    }

    empty.focusNodeIds = focusNodeIds;
    return empty;
  }

  function computeRoadmapVisibleNodeIds(baseNodeIds, edges, nodeMap) {
    const visible = new Set();
    const childrenMap = new Map();

    for (const edge of edges) {
      if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
      childrenMap.get(edge.source).push(edge.target);
    }

    const roots = [...baseNodeIds].filter((id) => nodeMap.get(id)?.type === 'book');
    const stack = [...roots];
    roots.forEach((id) => visible.add(id));

    while (stack.length) {
      const current = stack.pop();
      if (!state.roadmapExpandedNodes.has(current)) continue;

      for (const childId of childrenMap.get(current) || []) {
        if (!baseNodeIds.has(childId) || visible.has(childId)) continue;
        visible.add(childId);
        stack.push(childId);
      }
    }

    return visible;
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
        <div class="graph-tooltip-meta">${t('tooltipDiscipline')}: ${escapeHtml(disciplineLabel(resolveDomain(node)))}</div>
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
    const renderPreset = currentRenderPreset();
    const { nodeIds: baseNodeIds, edges: baseEdges } = getFilteredBaseSubgraph(view);

    let visibleNodeIds = computeLocalGraph(baseNodeIds, baseEdges);

    const edges = baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    const focusContext = computeFocusContext(state.selectedNodeId, visibleNodeIds, edges);
    const hasSelectedFocus = Boolean(state.selectedNodeId && visibleNodeIds.has(state.selectedNodeId));
    const hasDomainHighlights = state.highlightedDomains.size > 0;

    const nodes = [...visibleNodeIds].map((id) => {
      const node = nodeMap.get(id);
      const degree = edges.filter((edge) => edge.source === id || edge.target === id).length;
      const isSelected = state.selectedNodeId === id;
      const isUpstream = focusContext.upstream.has(id);
      const isDownstream = focusContext.downstream.has(id);
      const inFocus = focusContext.focusNodeIds.has(id);
      const domain = resolveDomain(node);
      const domainMatched = state.highlightedDomains.has(domain);

      const color = disciplineColor(node);
      let semanticBorder = disciplineColor(node);
      let semanticShadowColor = renderPreset.nodeShadowColor;

      const visual = nodeVisualByType(node); // <-- moved up before borderWidth usage

      if (!isSelected) {
        if (isUpstream && !isDownstream) {
          semanticBorder = renderPreset.upstreamBorder;
          semanticShadowColor = renderPreset.upstreamBorder;
        } else if (isDownstream && !isUpstream) {
          semanticBorder = renderPreset.downstreamBorder;
          semanticShadowColor = renderPreset.downstreamBorder;
        } else if (isUpstream && isDownstream) {
          semanticBorder = renderPreset.bothBorder;
          semanticShadowColor = renderPreset.bothBorder;
        }
      }

      const borderWidth = isSelected
        ? Math.max(visual.borderWidth + 1.4, 3)
        : inFocus
          ? Math.max(visual.borderWidth + 0.8, 2.2)
          : visual.borderWidth;

      const tooltip = buildKnowledgeTooltip(node);

      const fadedByFocus = hasSelectedFocus && !inFocus;
      const fadedByDomain = hasDomainHighlights && !domainMatched;
      const opacity = (fadedByFocus || fadedByDomain) ? renderPreset.fadedNodeOpacity : 1;

      return {
        id,
        label: nodeTitle(node),
        title: tooltipElement(tooltip),
        shape: visual.shape,
        size: Math.max(
          (visual.baseSize || 16) * state.tuning.nodeSizeScale,
          (visual.baseSize || 16) * state.tuning.nodeSizeScale + Math.log2(1 + degree) * state.tuning.degreeGain
        ),
        borderWidth,
        opacity,
        color: {
          background: color,
          border: isSelected ? renderPreset.selectedBorder : semanticBorder,
          highlight: {
            background: color,
            border: renderPreset.focusBorder
          }
        },
        shadow: {
          enabled: true,
          color: isSelected ? renderPreset.focusBorder : semanticShadowColor,
          size: isSelected ? (renderPreset.nodeShadowSize + 3) : renderPreset.nodeShadowSize,
          x: 0,
          y: 1
        },
        font: {
          color: cssVar('--text', '#18181b'),
          face: 'Inter'
        }
      };
    });

    const visEdges = edges.map((edge) => {
      const visual = edgeVisualByType(edge.type);
      const edgeId = `${edge.source}-${edge.type}-${edge.target}`;
      const isDirect = focusContext.directEdgeIds.has(edgeId);
      const inFocus = focusContext.focusNodeIds.has(edge.source) && focusContext.focusNodeIds.has(edge.target);
      const fadedByFocus = hasSelectedFocus && !inFocus;
      const sourceDomain = resolveDomain(nodeMap.get(edge.source));
      const targetDomain = resolveDomain(nodeMap.get(edge.target));
      const domainMatched = !hasDomainHighlights
        || state.highlightedDomains.has(sourceDomain)
        || state.highlightedDomains.has(targetDomain);
      const opacity = (fadedByFocus || !domainMatched) ? renderPreset.fadedEdgeOpacity : 1;
      const inStrongFocus = inFocus && hasSelectedFocus;
      const edgeColor = inStrongFocus ? edgeColorByType(edge.type) : renderPreset.edgeMutedColor;

      return {
        ...visual,
        width: (visual.width || 1.8) * state.tuning.edgeWidthScale * (isDirect ? renderPreset.edgeFocusBoost : 1),
        id: edgeId,
        from: edge.source,
        to: edge.target,
        label: edgeLabel(edge.type),
        opacity,
        color: {
          color: edgeColor,
          highlight: renderPreset.focusBorder
        },
        shadow: {
          enabled: true,
          color: renderPreset.edgeShadowColor,
          size: renderPreset.edgeShadowSize,
          x: 0,
          y: 0
        },
        font: {
          size: 10,
          color: cssVar('--muted', '#52525b')
        }
      };
    });

    return { nodes, edges: visEdges };
  }

  function getIncomingEdges(nodeId, edges) {
    return (edges || []).filter((edge) => edge.target === nodeId);
  }

  function getOutgoingEdges(nodeId, edges) {
    return (edges || []).filter((edge) => edge.source === nodeId);
  }

  function computeRelationSummary(nodeId, edges) {
    const incoming = getIncomingEdges(nodeId, edges);
    const outgoing = getOutgoingEdges(nodeId, edges);

    const incomingMap = new Map();
    const outgoingMap = new Map();
    for (const edge of edges) {
      if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      incomingMap.get(edge.target).push(edge.source);
      outgoingMap.get(edge.source).push(edge.target);
    }

    const walk = (map, seed) => {
      const visited = new Set();
      const stack = [...(map.get(seed) || [])];
      while (stack.length) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        for (const next of map.get(id) || []) {
          if (!visited.has(next)) stack.push(next);
        }
      }
      return visited;
    };

    return {
      directUpstream: incoming.length,
      directDownstream: outgoing.length,
      transitiveUpstream: walk(incomingMap, nodeId).size,
      transitiveDownstream: walk(outgoingMap, nodeId).size
    };
  }

  function renderDetail() {
    if (!EL.detail) return;
    const nodeMap = getNodeMap();
    const node = nodeMap.get(state.selectedNodeId);
    const { edges: activeEdges } = getFilteredBaseSubgraph();

    if (!node) {
      EL.detail.innerHTML = `
        <h2>Node details</h2>
        <p class="muted">${t('knowledgeMode')} · ${t('clickNode')}</p>
      `;
      return;
    }

    const incoming = getIncomingEdges(node.id, activeEdges);
    const outgoing = getOutgoingEdges(node.id, activeEdges);
    const summary = computeRelationSummary(node.id, activeEdges);

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
            const book = p.bookTitle || p.bookId || '';
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
        ${resolveDomain(node) ? `<span class="badge">${escapeHtml(disciplineLabel(resolveDomain(node)))}</span>` : ''}
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
      <div class="detail-section">
        <h4>${t('summary')}</h4>
        <ul class="mini-list">
          <li>${t('directUpstream')}: <strong>${summary.directUpstream}</strong></li>
          <li>${t('directDownstream')}: <strong>${summary.directDownstream}</strong></li>
          <li>${t('transitiveUpstream')}: <strong>${summary.transitiveUpstream}</strong></li>
          <li>${t('transitiveDownstream')}: <strong>${summary.transitiveDownstream}</strong></li>
        </ul>
      </div>
      ${isKnowledgeNodeType(node.type) ? `
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

    const nodeLegendItems = [];

    if (state.mode === 'knowledge') {
      const knowledgeTypes = [...new Set((view?.nodes || []).map((n) => n.knowledgeType || n.type))].sort();
      for (const kType of knowledgeTypes) {
        const sampleNode = (view?.nodes || []).find((n) => (n.knowledgeType || n.type) === kType) || { type: 'knowledge', knowledgeType: kType };
        const color = nodeColorByType(sampleNode);
        const visual = nodeVisualByType(sampleNode);
        nodeLegendItems.push(`<span><i class="legend-dot" style="background:${color}"></i><span class="legend-glyph">${visual.glyph}</span> ${escapeHtml(typeLabel(kType))}</span>`);
      }
    } else {
      for (const type of types) {
        const sampleNode = (view?.nodes || []).find((n) => n.type === type) || { type };
        const color = nodeColorByType(sampleNode);
        const visual = nodeVisualByType(sampleNode);
        nodeLegendItems.push(`<span><i class="legend-dot" style="background:${color}"></i><span class="legend-glyph">${visual.glyph}</span> ${escapeHtml(typeLabel(type))}</span>`);
      }
    }

    const nodeLegend = nodeLegendItems.join('');

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

    return {
      ...common,
      physics: {
        enabled: true,
        stabilization: { iterations: state.tuning.physicsIterations }
      }
    };
  }

  function syncNetworkSelection() {
    if (!state.network || !state.selectedNodeId) return;
    state.network.selectNodes([state.selectedNodeId]);
    if (state.shouldRefocus) {
      state.network.focus(state.selectedNodeId, { animation: { duration: 300 } });
      state.shouldRefocus = false;
    }
  }

  function captureViewport() {
    if (!state.network) return null;
    return {
      position: state.network.getViewPosition(),
      scale: state.network.getScale()
    };
  }

  function restoreViewport(viewport) {
    if (!state.network || !viewport) return;
    state.network.moveTo({
      position: viewport.position,
      scale: viewport.scale,
      animation: false
    });
  }

  function applyPreviousPositions(nodes, positions) {
    if (!positions || !nodes?.length) return nodes;
    return nodes.map((node) => {
      const pos = positions[node.id];
      if (!pos) return node;
      return {
        ...node,
        x: pos.x,
        y: pos.y
      };
    });
  }

  function renderNetwork() {
    if (!EL.canvas || !state.graphData) return;
    const viewport = captureViewport();
    const datasets = buildDatasets();
    const options = getNetworkOptions();
    const previousPositions = state.network ? state.network.getPositions() : null;
    const positionedNodes = applyPreviousPositions(datasets.nodes, previousPositions);

    if (!state.network) {
      state.network = new vis.Network(
        EL.canvas,
        {
          nodes: new vis.DataSet(positionedNodes),
          edges: new vis.DataSet(datasets.edges)
        },
        options
      );

      state.network.on('click', (params) => {
        const nodeId = params.nodes?.[0] || null;
        state.selectedNodeId = nodeId;

        renderDetail();
      });

      state.network.on('stabilizationIterationsDone', () => {
        if (!state.pendingViewport) return;
        restoreViewport(state.pendingViewport);
        state.pendingViewport = null;
      });
    } else {
      state.pendingViewport = viewport;
      state.network.setOptions(options);
      state.network.setData({
        nodes: new vis.DataSet(positionedNodes),
        edges: new vis.DataSet(datasets.edges)
      });
      restoreViewport(viewport);
    }

    renderDetail();
    syncNetworkSelection();
    renderLegend();
  }

  function resetFiltersForMode() {
    const view = getCurrentView();
    const nodes = view?.nodes || [];
    const edges = view?.edges || [];

    state.nodeTypeFilters = new Set(nodes.map((n) => n.type));
    state.domainFilters = new Set(nodes.map((n) => resolveDomain(n)));
    state.highlightedDomains = new Set(state.domainFilters);
    state.edgeTypeFilters = new Set(edges.map((e) => e.type));
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

  function renderDomainFilters() {
    const view = getCurrentView();
    const domains = sortDomains([...new Set((view?.nodes || []).map((n) => resolveDomain(n)))]);

    if (!EL.domainFilters) return;

    EL.domainFilters.innerHTML = domains
      .map((domain) => {
        const active = state.domainHighlightOnly
          ? state.highlightedDomains.has(domain)
          : state.domainFilters.has(domain);
        const activeClass = active ? 'is-active' : '';
        const border = disciplineColor(domain);
        return `<button class="filter-chip ${activeClass}" type="button" data-domain="${domain}" style="border-color:${border};">${escapeHtml(disciplineLabel(domain))}</button>`;
      })
      .join('');

    EL.domainFilters.querySelectorAll('[data-domain]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const domain = btn.dataset.domain;
        if (state.domainHighlightOnly) {
          const allHighlighted = state.highlightedDomains.size === domains.length;
          if (allHighlighted) {
            state.highlightedDomains = new Set([domain]);
          } else if (state.highlightedDomains.has(domain)) {
            state.highlightedDomains.delete(domain);
          } else {
            state.highlightedDomains.add(domain);
          }

          if (state.highlightedDomains.size === 0) {
            state.highlightedDomains = new Set(domains);
          }
        } else {
          if (state.domainFilters.has(domain)) state.domainFilters.delete(domain);
          else state.domainFilters.add(domain);

          if (state.domainFilters.size === 0) {
            state.domainFilters = new Set(domains);
          }
        }

        renderDomainFilters();
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
        state.shouldRefocus = true;
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
        btn.classList.toggle('is-active', btn.dataset.graphMode === 'knowledge');
      });
    }

    state.mode = 'knowledge';

    EL.focusModeSwitch?.querySelectorAll('[data-focus-mode]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.focusMode === state.focusMode);
    });
    EL.depthModeSwitch?.querySelectorAll('[data-depth-mode]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.depthMode === state.depthMode);
    });
    if (EL.domainHighlightOnly) {
      EL.domainHighlightOnly.checked = state.domainHighlightOnly;
    }

    resetFiltersForMode();
    renderTypeFilters();
    renderDomainFilters();
    renderEdgeFilters();
    renderNetwork();
  }

  function bindControls() {
    const clampDrawerPosition = (left, top) => {
      if (!EL.settingsPanel) return { left, top };
      const margin = 10;
      const minTop = 76;
      const panelRect = EL.settingsPanel.getBoundingClientRect();
      const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
      const maxTop = Math.max(minTop, window.innerHeight - panelRect.height - margin);

      return {
        left: Math.max(margin, Math.min(left, maxLeft)),
        top: Math.max(minTop, Math.min(top, maxTop))
      };
    };

    const positionSettingsDrawer = () => {
      if (!EL.settingsPanel || !EL.settingsToggle) return;

      const toggleRect = EL.settingsToggle.getBoundingClientRect();
      const panelRect = EL.settingsPanel.getBoundingClientRect();
      const gap = 10;
      const minTop = 76;
      const margin = 10;

      let top = Math.max(minTop, toggleRect.bottom + gap);
      let left = toggleRect.right - panelRect.width;

      const next = clampDrawerPosition(left, top);

      EL.settingsPanel.style.top = `${next.top}px`;
      EL.settingsPanel.style.left = `${next.left}px`;
    };

    const drag = {
      active: false,
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0
    };

    const onDragMove = (event) => {
      if (!drag.active || !EL.settingsPanel) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const next = clampDrawerPosition(drag.originLeft + dx, drag.originTop + dy);
      EL.settingsPanel.style.left = `${next.left}px`;
      EL.settingsPanel.style.top = `${next.top}px`;
    };

    const stopDrag = () => {
      if (!drag.active) return;
      drag.active = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', stopDrag);
      document.body.classList.remove('graph-settings-dragging');
    };

    EL.settingsHeader?.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || !EL.settingsPanel) return;
      if (event.target.closest('[data-graph-settings-close]')) return;

      const style = window.getComputedStyle(EL.settingsPanel);
      const currentLeft = Number.parseFloat(style.left) || EL.settingsPanel.getBoundingClientRect().left;
      const currentTop = Number.parseFloat(style.top) || EL.settingsPanel.getBoundingClientRect().top;

      drag.active = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.originLeft = currentLeft;
      drag.originTop = currentTop;
      state.settingsDragged = true;

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', stopDrag);
      document.body.classList.add('graph-settings-dragging');
      event.preventDefault();
    });

    const setSettingsOpen = (open) => {
      if (EL.settingsToggle) {
        EL.settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (EL.settingsPanel) {
        EL.settingsPanel.hidden = !open;
        EL.settingsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) {
          state.settingsDragged = false;
          requestAnimationFrame(positionSettingsDrawer);
        } else {
          stopDrag();
          EL.settingsPanel.style.removeProperty('top');
          EL.settingsPanel.style.removeProperty('left');
        }
      }
      if (EL.settingsBackdrop) {
        EL.settingsBackdrop.hidden = !open;
      }
      document.body.classList.toggle('graph-settings-open', open);
    };

    EL.settingsToggle?.addEventListener('click', () => {
      const expanded = EL.settingsToggle.getAttribute('aria-expanded') === 'true';
      setSettingsOpen(!expanded);
    });

    EL.settingsClose?.addEventListener('click', () => {
      setSettingsOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const expanded = EL.settingsToggle?.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        setSettingsOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      const expanded = EL.settingsToggle?.getAttribute('aria-expanded') === 'true';
      if (expanded && state.settingsDragged) {
        const style = window.getComputedStyle(EL.settingsPanel);
        const currentLeft = Number.parseFloat(style.left) || EL.settingsPanel.getBoundingClientRect().left;
        const currentTop = Number.parseFloat(style.top) || EL.settingsPanel.getBoundingClientRect().top;
        const next = clampDrawerPosition(currentLeft, currentTop);
        EL.settingsPanel.style.left = `${next.left}px`;
        EL.settingsPanel.style.top = `${next.top}px`;
      } else if (expanded) {
        positionSettingsDrawer();
      }
    });

    EL.search.addEventListener('input', () => {
      state.search = EL.search.value;
      renderNetwork();
    });

    EL.depth.addEventListener('input', () => {
      state.localDepth = Number(EL.depth.value);
      EL.depthLabel.textContent = String(state.localDepth);
      renderNetwork();
    });

    EL.depthModeSwitch?.querySelectorAll('[data-depth-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.depthMode = btn.dataset.depthMode === 'directed' ? 'directed' : 'undirected';
        EL.depthModeSwitch.querySelectorAll('[data-depth-mode]').forEach((item) => {
          item.classList.toggle('is-active', item === btn);
        });
        renderNetwork();
      });
    });

    EL.focusModeSwitch?.querySelectorAll('[data-focus-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.focusMode = btn.dataset.focusMode || 'neighbors';
        EL.focusModeSwitch.querySelectorAll('[data-focus-mode]').forEach((item) => {
          item.classList.toggle('is-active', item === btn);
        });
        renderNetwork();
      });
    });

    EL.domainHighlightOnly?.addEventListener('change', () => {
      state.domainHighlightOnly = Boolean(EL.domainHighlightOnly.checked);
      if (state.domainHighlightOnly && state.highlightedDomains.size === 0) {
        state.highlightedDomains = new Set(state.domainFilters);
      }
      renderDomainFilters();
      renderNetwork();
    });

    document.querySelectorAll('[data-query]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.query;
        const { title, ids } = runQuery(kind);
        state.queryResultIds = ids;
        renderQueryResults(title, ids);
        renderNetwork();
      });
    });

    EL.tuningInputs?.forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.tuningKey;
        applyTuningValue(key, Number(input.value));
      });
    });

    EL.tuningNumberInputs?.forEach((input) => {
      const commitValue = () => {
        const key = input.dataset.tuningNumber;
        applyTuningValue(key, Number(input.value));
      };
      input.addEventListener('input', commitValue);
      input.addEventListener('change', commitValue);
    });

    EL.tuningReset?.addEventListener('click', () => {
      setTuning(DEFAULT_TUNING);
      renderNetwork();
    });
  }

  function cacheElements() {
    EL.canvas = document.querySelector('[data-graph-canvas]');
    EL.detail = document.querySelector('[data-graph-detail]');
    EL.search = document.querySelector('[data-graph-search]');
    EL.depth = document.querySelector('[data-graph-depth]');
    EL.depthLabel = document.querySelector('[data-graph-depth-label]');
    EL.depthModeSwitch = document.querySelector('[data-depth-mode-switch]');
    EL.focusModeSwitch = document.querySelector('[data-focus-mode-switch]');
    EL.nodeTypeFilters = document.querySelector('[data-node-type-filters]');
    EL.domainFilters = document.querySelector('[data-domain-filters]');
    EL.domainHighlightOnly = document.querySelector('[data-domain-highlight-only]');
    EL.edgeTypeFilters = document.querySelector('[data-edge-type-filters]');
    EL.queryResults = document.querySelector('[data-query-results]');
    EL.modeSwitch = document.querySelector('[data-graph-mode-switch]');
    EL.legend = document.querySelector('[data-graph-legend]');
    EL.settingsToggle = document.querySelector('[data-graph-settings-toggle]');
    EL.settingsPanel = document.querySelector('[data-graph-settings-panel]');
    EL.settingsHeader = document.querySelector('.graph-settings-drawer-header');
    EL.settingsClose = document.querySelector('[data-graph-settings-close]');
    EL.settingsBackdrop = document.querySelector('[data-graph-settings-backdrop]');
    EL.tuningInputs = document.querySelectorAll('[data-tuning-key]');
    EL.tuningNumberInputs = document.querySelectorAll('[data-tuning-number]');
    EL.tuningReset = document.querySelector('[data-tuning-reset]');
  }

  async function loadGraph() {
    const response = await fetch(`graph/knowledge-graph.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load graph data: ${response.status}`);
    }
    return response.json();
  }

  async function loadTuningProfile() {
    try {
      const response = await fetch('graph/tuning-config.json');
      if (!response.ok) {
        return { ...DEFAULT_TUNING };
      }
      const payload = await response.json();
      return normalizeTuning(payload?.graphTuning || payload || {});
    } catch {
      return { ...DEFAULT_TUNING };
    }
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
      setTuning(await loadTuningProfile());
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

      document.addEventListener('kg:themechange', () => {
        renderNetwork();
      });

      document.addEventListener('kg:datarefresh', async () => {
        try {
          state.graphData = await loadGraph();
          state.selectedNodeId = null;
          resetFiltersForMode();
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
