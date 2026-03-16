const KnowledgeGraphSite = (() => {
  let cachedGraph = null;
  let currentLang = 'zh';

  const STORAGE_KEYS = {
    theme: 'kg-theme',
    lang: 'kg-lang',
    knowledgeSidebarCollapsed: 'kg-knowledge-sidebar-collapsed'
  };

  const UI = {
    zh: {
      themeLight: '白天',
      themeDark: '黑夜',
      langLabel: 'EN',
      readInKnowledge: '进入 Knowledge',
      noKnowledgeNodes: '暂无知识节点。',
      loadingLatest: '正在加载最新知识节点...',
      noMatchNode: '没有匹配节点，请尝试其他筛选或关键词。',
      learningObjective: '学习目标',
      commonErrors: '常见错误',
      verificationSteps: '验证步骤',
      relatedEvidence: '关联项目证据',
      sourceNode: '节点源文件',
      openMarkdown: '打开 Markdown 节点',
      noneRecorded: '暂无记录。',
      noEvidence: '暂无关联项目证据。',
      noNodesFound: '没有找到节点，请尝试更宽泛的关键词。',
      graphLoadError: '暂时无法加载图谱数据。',
      aliases: '别名',
      collapseSidebar: '收起侧边栏',
      expandSidebar: '展开侧边栏'
    },
    en: {
      themeLight: 'Light',
      themeDark: 'Dark',
      langLabel: '中文',
      readInKnowledge: 'Read in Knowledge',
      noKnowledgeNodes: 'No knowledge nodes yet.',
      loadingLatest: 'Loading latest knowledge notes...',
      noMatchNode: 'No matching node. Try another filter or search keyword.',
      learningObjective: 'Learning objective',
      commonErrors: 'Common errors',
      verificationSteps: 'Verification steps',
      relatedEvidence: 'Related project evidence',
      sourceNode: 'Source node file',
      openMarkdown: 'Open Markdown node',
      noneRecorded: 'None recorded yet.',
      noEvidence: 'No linked project evidence yet.',
      noNodesFound: 'No nodes found. Try a broader keyword.',
      graphLoadError: 'Unable to load graph data right now.',
      aliases: 'Aliases',
      collapseSidebar: 'Collapse sidebar',
      expandSidebar: 'Expand sidebar'
    }
  };

  const DOMAIN_KEYWORDS = {
    'all': [],
    'philosophy': ['philosophy', 'epistemology', 'ontology', '意识', '哲学'],
    'mathematics': ['mathematics', 'math', 'linear algebra', 'probability', 'optimization', '信息论', '数学'],
    'physics': ['physics', 'dynamics', 'complex system', 'statistical', '物理', '动力学'],
    'economics': ['economics', 'finance', 'risk', 'market', 'quant', '经济', '金融'],
    'neuroscience': ['neuroscience', 'neural', 'brain', 'memory', '神经'],
    'psychology': ['psychology', 'cognitive', 'behavior', 'bias', '心理'],
    'computer-science': ['computer science', 'algorithm', 'system', 'software', 'ml', 'agent', '计算机'],
    'control-theory-cybernetics': ['control', 'control theory', 'cybernetics', 'feedback', 'stability', 'system identification', '控制', '控制论'],
    'linguistics': ['linguistics', 'semantics', 'syntax', 'pragmatics', '语义', '语法'],
    'artificial-intelligence': ['artificial intelligence', 'ai', 'machine learning', 'deep learning', 'llm', 'agent', '人工智能', '机器学习', '深度学习']
  };

  function t(key) {
    return UI[currentLang][key] ?? UI.en[key] ?? key;
  }

  async function loadGraph() {
    if (cachedGraph) {
      return cachedGraph;
    }
    const response = await fetch('graph/knowledge-graph.json');
    if (!response.ok) {
      throw new Error(`Failed to load graph: ${response.status}`);
    }
    cachedGraph = await response.json();
    return cachedGraph;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) {
        link.classList.add('active');
      }
    });
  }

  function getStoredTheme() {
    const theme = localStorage.getItem(STORAGE_KEYS.theme);
    if (theme === 'dark' || theme === 'light') {
      return theme;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    updateThemeButton();

    const collapseButton = document.querySelector('[data-sidebar-collapse]');
    if (collapseButton) {
      const isCollapsed = document.body.classList.contains('knowledge-sidebar-collapsed');
      const title = isCollapsed ? t('expandSidebar') : t('collapseSidebar');
      collapseButton.setAttribute('title', title);
      collapseButton.setAttribute('aria-label', title);
    }
  }

  function updateThemeButton() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.querySelector('[data-theme-toggle]');
    const icon = document.querySelector('[data-theme-toggle] i');
    const label = document.querySelector('[data-theme-label]');
    if (icon) {
      icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (label) {
      label.textContent = isDark ? t('themeLight') : t('themeDark');
    }
    if (btn) {
      btn.setAttribute('aria-label', isDark ? t('themeLight') : t('themeDark'));
      btn.setAttribute('title', isDark ? t('themeLight') : t('themeDark'));
    }
  }

  function getStoredLang() {
    const lang = localStorage.getItem(STORAGE_KEYS.lang);
    return lang === 'en' ? 'en' : 'zh';
  }

  function applyLanguage() {
    document.documentElement.setAttribute('lang', currentLang === 'zh' ? 'zh-CN' : 'en');

    document.querySelectorAll('[data-i18n-zh][data-i18n-en]').forEach((element) => {
      const value = currentLang === 'zh' ? element.dataset.i18nZh : element.dataset.i18nEn;
      if (value !== undefined) {
        element.innerHTML = value;
      }
    });

    document.querySelectorAll('[data-i18n-ph-zh][data-i18n-ph-en]').forEach((element) => {
      const value = currentLang === 'zh' ? element.dataset.i18nPhZh : element.dataset.i18nPhEn;
      if (value !== undefined) {
        element.setAttribute('placeholder', value);
      }
    });

    const langLabel = document.querySelector('[data-lang-label]');
    const langButton = document.querySelector('[data-lang-toggle]');
    if (langLabel) {
      langLabel.textContent = t('langLabel');
    }
    if (langButton) {
      langButton.setAttribute('aria-label', currentLang === 'zh' ? 'Switch to English' : '切换到中文');
      langButton.setAttribute('title', currentLang === 'zh' ? 'Switch to English' : '切换到中文');
    }

    updateThemeButton();
  }

  function setLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
    applyLanguage();

    if (cachedGraph) {
      renderLatestKnowledge(cachedGraph.nodes);
      renderKnowledgeExplorer(cachedGraph);
    }
  }

  function initControls() {
    setTheme(getStoredTheme());
    currentLang = getStoredLang();
    applyLanguage();

    const themeButton = document.querySelector('[data-theme-toggle]');
    if (themeButton) {
      themeButton.addEventListener('click', () => {
        const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(now);
      });
    }

    const langButton = document.querySelector('[data-lang-toggle]');
    if (langButton) {
      langButton.addEventListener('click', () => {
        setLanguage(currentLang === 'zh' ? 'en' : 'zh');
      });
    }
  }

  function initKnowledgeSidebar() {
    if (document.body.dataset.page !== 'knowledge') {
      return;
    }

    const collapseButton = document.querySelector('[data-sidebar-collapse]');
    const openButton = document.querySelector('[data-sidebar-open]');
    const backdrop = document.querySelector('[data-sidebar-backdrop]');
    const domainToggles = document.querySelectorAll('[data-domain-toggle]');

    const storedCollapsed = localStorage.getItem(STORAGE_KEYS.knowledgeSidebarCollapsed) === '1';
    document.body.classList.toggle('knowledge-sidebar-collapsed', storedCollapsed);

    function updateSidebarButton() {
      const isCollapsed = document.body.classList.contains('knowledge-sidebar-collapsed');
      const icon = collapseButton?.querySelector('i');
      if (icon) {
        icon.className = isCollapsed ? 'fas fa-angles-right' : 'fas fa-angles-left';
      }
      if (collapseButton) {
        const title = isCollapsed ? t('expandSidebar') : t('collapseSidebar');
        collapseButton.setAttribute('title', title);
        collapseButton.setAttribute('aria-label', title);
      }
    }

    updateSidebarButton();

    collapseButton?.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('knowledge-sidebar-collapsed');
      localStorage.setItem(STORAGE_KEYS.knowledgeSidebarCollapsed, isCollapsed ? '1' : '0');
      updateSidebarButton();
    });

    openButton?.addEventListener('click', () => {
      document.body.classList.add('knowledge-sidebar-open');
    });

    backdrop?.addEventListener('click', () => {
      document.body.classList.remove('knowledge-sidebar-open');
    });

    domainToggles.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const group = trigger.closest('[data-domain-group]');
        if (!group) {
          return;
        }
        const isOpen = group.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  function renderLatestKnowledge(nodes) {
    const container = document.querySelector('[data-latest-knowledge]');
    if (!container) {
      return;
    }
    const latest = nodes.filter((node) => node.type !== 'project').slice(0, 4);
    if (latest.length === 0) {
      container.innerHTML = `<div class="empty-state">${t('noKnowledgeNodes')}</div>`;
      return;
    }
    container.innerHTML = latest.map((node) => `
      <article class="post-card">
        <h3>${escapeHtml(node.title)}</h3>
        <p>${escapeHtml(node.summary)}</p>
        <div class="post-meta">
          <span class="badge">${escapeHtml(node.type)}</span>
          <span class="badge">${escapeHtml(node.difficulty)}</span>
        </div>
        <a class="inline-link" href="knowledge.html?node=${encodeURIComponent(node.id)}">${t('readInKnowledge')} <span aria-hidden="true">→</span></a>
      </article>
    `).join('');
  }

  function renderHomeStats(graph) {
    const nodesStat = document.querySelector('[data-stat="nodes"]');
    const edgesStat = document.querySelector('[data-stat="edges"]');
    const projectStat = document.querySelector('[data-stat="projects"]');
    if (nodesStat) nodesStat.textContent = String(graph.nodes.length);
    if (edgesStat) edgesStat.textContent = String(graph.edges.length);
    if (projectStat) projectStat.textContent = String(graph.nodes.filter((node) => node.type === 'project').length);
  }

  function nodeMatches(node, query, filter) {
    const normalized = query.trim().toLowerCase();
    const searchable = [
      node.id,
      node.title,
      node.summary,
      ...(node.aliases || []),
      ...(node.tags || []),
      ...(node.retrievalKeywords || [])
    ].join(' ').toLowerCase();

    const filterPassed = filter === 'all' ? node.type !== 'project' : node.type === filter;
    const queryPassed = !normalized || searchable.includes(normalized);
    return filterPassed && queryPassed;
  }

  function nodeMatchesDomain(node, domainFilter) {
    if (!domainFilter || domainFilter === 'all') {
      return true;
    }

    const keywords = DOMAIN_KEYWORDS[domainFilter] || [domainFilter];
    const haystack = [
      node.id,
      node.title,
      node.summary,
      ...(node.tags || []),
      ...(node.aliases || []),
      ...(node.retrievalKeywords || [])
    ].join(' ').toLowerCase();

    return keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
  }

  function renderKnowledgeExplorer(graph) {
    const root = document.querySelector('[data-knowledge-explorer]');
    if (!root) {
      return;
    }

    const nodes = graph.nodes.filter((node) => node.type !== 'project');
    const list = root.querySelector('[data-node-list]');
    const detail = root.querySelector('[data-node-detail]');
    const input = root.querySelector('[data-node-search]');
    const chips = Array.from(root.querySelectorAll('[data-filter]'));
    const domainButtons = Array.from(root.querySelectorAll('[data-domain-filter]'));
    let activeFilter = 'all';
    let activeDomainFilter = 'all';
    let activeId = new URLSearchParams(window.location.search).get('node') || nodes[0]?.id || null;

    function getVisibleNodes() {
      const query = input.value || '';
      return nodes.filter((node) => nodeMatches(node, query, activeFilter) && nodeMatchesDomain(node, activeDomainFilter));
    }

    function renderDetail(node) {
      if (!node) {
        detail.innerHTML = `<div class="empty-state">${t('noMatchNode')}</div>`;
        return;
      }

      const projectLinks = (node.projectLinks || []).map((link) => `<li><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></li>`).join('');
      const tags = (node.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('');
      const errors = (node.commonErrors || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const steps = (node.verificationSteps || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const aliases = (node.aliases || []).join(' / ');
      detail.innerHTML = `
        <div class="detail-meta">
          <span class="badge">${escapeHtml(node.type)}</span>
          <span class="badge">${escapeHtml(node.difficulty)}</span>
        </div>
        <h3>${escapeHtml(node.title)}</h3>
        <p>${escapeHtml(node.summary)}</p>
        ${aliases ? `<p class="muted"><strong>${t('aliases')}:</strong> ${escapeHtml(aliases)}</p>` : ''}
        <div class="post-meta">${tags}</div>
        <div class="detail-section">
          <h4>${t('learningObjective')}</h4>
          <p>${escapeHtml(node.learningObjective || t('noneRecorded'))}</p>
        </div>
        <div class="detail-section">
          <h4>${t('commonErrors')}</h4>
          <ul class="mini-list">${errors || `<li>${t('noneRecorded')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('verificationSteps')}</h4>
          <ul class="mini-list">${steps || `<li>${t('noneRecorded')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('relatedEvidence')}</h4>
          <ul class="link-list">${projectLinks || `<li class="muted">${t('noEvidence')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('sourceNode')}</h4>
          <a class="inline-link" href="${escapeHtml(node.sourcePath || '#')}">${t('openMarkdown')} <span aria-hidden="true">→</span></a>
        </div>
      `;
    }

    function renderList() {
      const visibleNodes = getVisibleNodes();
      if (!visibleNodes.some((node) => node.id === activeId)) {
        activeId = visibleNodes[0]?.id || null;
      }

      if (visibleNodes.length === 0) {
        list.innerHTML = `<div class="empty-state">${t('noNodesFound')}</div>`;
        renderDetail(null);
        return;
      }

      list.innerHTML = visibleNodes.map((node) => `
        <article class="post-card ${node.id === activeId ? 'is-active' : ''}">
          <button type="button" data-node-id="${escapeHtml(node.id)}">
            <h3>${escapeHtml(node.title)}</h3>
            <p>${escapeHtml(node.summary)}</p>
            <div class="post-meta">
              <span class="badge">${escapeHtml(node.type)}</span>
              <span class="badge">${escapeHtml(node.difficulty)}</span>
            </div>
          </button>
        </article>
      `).join('');

      const activeNode = visibleNodes.find((node) => node.id === activeId) || visibleNodes[0];
      if (activeNode) {
        activeId = activeNode.id;
      }
      renderDetail(activeNode);
    }

    list.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-node-id]');
      if (!trigger) {
        return;
      }
      activeId = trigger.dataset.nodeId;
      const params = new URLSearchParams(window.location.search);
      params.set('node', activeId);
      history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      renderList();
    });

    input.addEventListener('input', renderList);
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((item) => item.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeFilter = chip.dataset.filter;
        renderList();
      });
    });

    domainButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const selected = button.dataset.domainFilter || 'all';
        const isAlreadyActive = selected === activeDomainFilter;

        domainButtons.forEach((item) => item.classList.remove('is-active'));
        activeDomainFilter = isAlreadyActive ? 'all' : selected;
        if (!isAlreadyActive) {
          button.classList.add('is-active');
        }

        document.body.classList.remove('knowledge-sidebar-open');
        renderList();
      });
    });

    renderList();
  }

  async function init() {
    initControls();
    initKnowledgeSidebar();
    setActiveNav();

    const latest = document.querySelector('[data-latest-knowledge]');
    if (latest) {
      latest.innerHTML = t('loadingLatest');
    }

    try {
      const graph = await loadGraph();
      renderHomeStats(graph);
      renderLatestKnowledge(graph.nodes);
      renderKnowledgeExplorer(graph);
    } catch (error) {
      console.error(error);
      document.querySelectorAll('[data-latest-knowledge], [data-node-list], [data-node-detail]').forEach((element) => {
        if (element) {
          element.innerHTML = `<div class="empty-state">${t('graphLoadError')}</div>`;
        }
      });
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', KnowledgeGraphSite.init);
