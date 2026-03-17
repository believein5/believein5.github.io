const KnowledgeGraphSite = (() => {
  let cachedGraph = null;
  let currentLang = 'zh';
  let resyncTopNavOverflow = null;
  let isRefreshingGraphData = false;

  const STORAGE_KEYS = {
    theme: 'kg-theme',
    lang: 'kg-lang',
    knowledgeSidebarCollapsed: 'kg-knowledge-sidebar-collapsed',
    librarySidebarCollapsed: 'kg-library-sidebar-collapsed',
    projectSidebarCollapsed: 'kg-project-sidebar-collapsed',
    topNavExpanded: 'kg-top-nav-expanded'
  };

  const UI = {
    zh: {
      themeLight: '白天',
      themeDark: '黑夜',
      langLabel: 'EN',
      refreshData: '刷新',
      refreshingData: '刷新中...',
      readInKnowledge: '进入 Knowledge',
      noKnowledgeNodes: '暂无知识节点。',
      loadingLatest: '正在加载最新知识节点...',
      noMatchNode: '没有匹配节点，请尝试其他筛选或关键词。',
      learningObjective: '学习目标',
      commonErrors: '常见错误',
      verificationSteps: '验证步骤',
      relatedEvidence: '关联项目证据',
      definitionSource: '定义来源',
      supportingSources: '支撑来源',
      citedSources: '引用来源',
      sourceNode: '节点源文件',
      openMarkdown: '打开 Markdown 节点',
      noneRecorded: '暂无记录。',
      noEvidence: '暂无关联项目证据。',
      noSourceRefs: '暂无来源记录。',
      noNodesFound: '没有找到节点，请尝试更宽泛的关键词。',
      graphLoadError: '暂时无法加载图谱数据。',
      aliases: '别名',
      collapseSidebar: '收起侧边栏',
      expandSidebar: '展开侧边栏',
      expandTopNav: '展开导航',
      collapseTopNav: '收起导航'
    },
    en: {
      themeLight: 'Light',
      themeDark: 'Dark',
      langLabel: '中文',
      refreshData: 'Refresh',
      refreshingData: 'Refreshing...',
      readInKnowledge: 'Read in Knowledge',
      noKnowledgeNodes: 'No knowledge nodes yet.',
      loadingLatest: 'Loading latest knowledge notes...',
      noMatchNode: 'No matching node. Try another filter or search keyword.',
      learningObjective: 'Learning objective',
      commonErrors: 'Common errors',
      verificationSteps: 'Verification steps',
      relatedEvidence: 'Related project evidence',
      definitionSource: 'Definition sources',
      supportingSources: 'Supporting sources',
      citedSources: 'Cited sources',
      sourceNode: 'Source node file',
      openMarkdown: 'Open Markdown node',
      noneRecorded: 'None recorded yet.',
      noEvidence: 'No linked project evidence yet.',
      noSourceRefs: 'No source references yet.',
      noNodesFound: 'No nodes found. Try a broader keyword.',
      graphLoadError: 'Unable to load graph data right now.',
      aliases: 'Aliases',
      collapseSidebar: 'Collapse sidebar',
      expandSidebar: 'Expand sidebar',
      expandTopNav: 'Expand navigation',
      collapseTopNav: 'Collapse navigation'
    }
  };

  function updateTopNavToggle() {
    const button = document.querySelector('[data-topnav-toggle]');
    const text = button?.querySelector('[data-topnav-toggle-text]');
    const siteNav = document.querySelector('.site-nav');
    if (!button || !siteNav) return;

    const expanded = siteNav.classList.contains('overflow-expanded');
    if (text) {
      text.textContent = expanded ? '▾' : '▸';
    }
    const label = expanded ? t('collapseTopNav') : t('expandTopNav');
    button.setAttribute('title', label);
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function initTopNavCollapse() {
    const siteNav = document.querySelector('.site-nav');
    const navRight = document.querySelector('.nav-right');
    const navControls = document.querySelector('.nav-controls');
    const navLinks = document.querySelector('.nav-links');
    if (!siteNav || !navRight || !navControls || !navLinks) return;

    let button = navRight.querySelector('[data-topnav-toggle]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-btn topnav-toggle';
      button.setAttribute('data-topnav-toggle', '');
      button.innerHTML = '<span data-topnav-toggle-text>▸</span>';
      navControls.prepend(button);
    }

    let overflowPanel = navControls.querySelector('[data-topnav-overflow-panel]');
    if (!overflowPanel) {
      overflowPanel = document.createElement('div');
      overflowPanel.className = 'topnav-overflow-panel';
      overflowPanel.setAttribute('data-topnav-overflow-panel', '');
      overflowPanel.setAttribute('aria-label', 'Overflow navigation');
      navControls.append(overflowPanel);
    }

    let storedExpanded = localStorage.getItem(STORAGE_KEYS.topNavExpanded) === '1';

    const setExpanded = (expanded) => {
      siteNav.classList.toggle('overflow-expanded', expanded);
      storedExpanded = expanded;
      localStorage.setItem(STORAGE_KEYS.topNavExpanded, expanded ? '1' : '0');
      updateTopNavToggle();
    };

    const renderOverflowPanel = (overflowLinks) => {
      overflowPanel.innerHTML = overflowLinks
        .map((link) => {
          const href = link.getAttribute('href') || '#';
          const label = link.textContent || '';
          const active = link.classList.contains('active') ? 'active' : '';
          return `<a class="topnav-overflow-link ${active}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
        })
        .join('');

      overflowPanel.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => setExpanded(false));
      });
    };

    const syncOverflow = () => {
      const links = [...navLinks.querySelectorAll('a')];
      links.forEach((link) => link.classList.remove('is-overflow-hidden'));
      overflowPanel.innerHTML = '';

      if (links.length < 2) {
        siteNav.classList.remove('has-overflow-links', 'overflow-expanded');
        button.hidden = true;
        updateTopNavToggle();
        return;
      }

      const firstTop = Math.round(links[0].getBoundingClientRect().top);
      const overflowLinks = links.filter((link) => Math.round(link.getBoundingClientRect().top) > firstTop + 1);

      if (!overflowLinks.length) {
        siteNav.classList.remove('has-overflow-links', 'overflow-expanded');
        button.hidden = true;
        updateTopNavToggle();
        return;
      }

      overflowLinks.forEach((link) => link.classList.add('is-overflow-hidden'));
      renderOverflowPanel(overflowLinks);
      siteNav.classList.add('has-overflow-links');
      button.hidden = false;
      setExpanded(storedExpanded);
    };

    button.addEventListener('click', () => {
      if (!siteNav.classList.contains('has-overflow-links')) return;
      setExpanded(!siteNav.classList.contains('overflow-expanded'));
    });

    document.addEventListener('click', (event) => {
      if (!siteNav.classList.contains('overflow-expanded')) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (navControls.contains(target)) return;
      setExpanded(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && siteNav.classList.contains('overflow-expanded')) {
        setExpanded(false);
      }
    });

    window.addEventListener('resize', syncOverflow);
    resyncTopNavOverflow = syncOverflow;
    syncOverflow();
  }

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

  const DISCIPLINE_LABELS = {
    mathematics: { zh: '数学', en: 'Mathematics' },
    physics: { zh: '物理', en: 'Physics' },
    economics: { zh: '经济学', en: 'Economics' },
    neuroscience: { zh: '神经科学', en: 'Neuroscience' },
    psychology: { zh: '心理学', en: 'Psychology' },
    'computer-science': { zh: '计算机科学', en: 'Computer Science' },
    'control-theory-cybernetics': { zh: '控制理论与控制论', en: 'Control Theory & Cybernetics' },
    linguistics: { zh: '语言学', en: 'Linguistics' },
    philosophy: { zh: '哲学', en: 'Philosophy' },
    'artificial-intelligence': { zh: '人工智能', en: 'Artificial Intelligence' }
  };

  const BOOK_AUTHOR_OVERRIDES = {
    'book-ai-aima-4e': 'Stuart Russell, Peter Norvig',
    'book-pdf-artificial-intelligence-a-modern-approach': 'Stuart Russell, Peter Norvig'
  };

  function t(key) {
    return UI[currentLang][key] ?? UI.en[key] ?? key;
  }

  function updateSidebarCollapseButton(button, textNode, collapsedClassName) {
    if (!button) return;

    const isCollapsed = document.body.classList.contains(collapsedClassName);
    if (textNode) {
      textNode.textContent = isCollapsed ? '>>' : '<<';
    }

    const title = isCollapsed ? t('expandSidebar') : t('collapseSidebar');
    button.setAttribute('title', title);
    button.setAttribute('aria-label', title);
  }

  async function loadGraph() {
    if (cachedGraph) {
      return cachedGraph;
    }
    const response = await fetch(`graph/knowledge-graph.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load graph: ${response.status}`);
    }
    cachedGraph = await response.json();
    return cachedGraph;
  }

  function normalizeKnowledgeGraphPayload(graph) {
    const rawNodes = graph?.views?.knowledge?.nodes || graph?.nodes || [];
    const rawEdges = graph?.views?.knowledge?.edges || graph?.edges || [];

    const nodes = rawNodes.map((node) => {
      const normalizedType = node.knowledgeType || node.type || 'concept';
      return {
        ...node,
        type: normalizedType,
        summary: node.summary || '',
        difficulty: node.difficulty || 'intermediate',
        tags: Array.isArray(node.tags) ? node.tags : [],
        provenanceLinks: Array.isArray(node.provenanceLinks) ? node.provenanceLinks : [],
        taxonomyDomain: node.taxonomyDomain || 'computer-science'
      };
    });

    return {
      ...graph,
      nodes,
      edges: rawEdges
    };
  }

  function normalizeBookGraphPayload(graph) {
    const rawNodes = graph?.views?.book?.nodes || [];
    const rawEdges = graph?.views?.book?.edges || [];
    return {
      ...graph,
      nodes: rawNodes,
      edges: rawEdges
    };
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function pickLocalizedText(node, fallback = '') {
    const i18n = node?.titleI18n;
    if (i18n && typeof i18n === 'object') {
      return currentLang === 'en'
        ? (i18n.en || i18n.zh || fallback || node?.title || '')
        : (i18n.zh || i18n.en || fallback || node?.title || '');
    }
    return node?.title || fallback;
  }

  function disciplineName(domain) {
    const label = DISCIPLINE_LABELS[domain];
    if (!label) return domain || '-';
    return currentLang === 'en' ? (label.en || label.zh || domain) : (label.zh || label.en || domain);
  }

  function inferBookAuthor(book) {
    const key = book?.bookId || book?.rawId || '';
    return BOOK_AUTHOR_OVERRIDES[key] || (currentLang === 'en' ? 'Unknown' : '未知');
  }

  function normalizeBookTitleKey(title = '') {
    return String(title)
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalBookGroupId(book) {
    const key = normalizeBookTitleKey(pickLocalizedText(book, book?.title || ''));
    if (key.includes('artificial intelligence') && key.includes('modern approach')) {
      return 'merged-book-ai-aima';
    }
    return `single-${book?.bookId || book?.rawId || book?.id}`;
  }

  function createBookGroups(bookGraph) {
    const books = (bookGraph.nodes || []).filter((node) => node.type === 'book');
    const groups = new Map();

    books.forEach((book) => {
      const groupId = canonicalBookGroupId(book);
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          books: []
        });
      }
      groups.get(groupId).books.push(book);
    });

    return [...groups.values()].map((group) => {
      const preferred = group.books.find((book) => (book.bookId || '').includes('aima-4e')) || group.books[0];
      return {
        id: group.id,
        books: group.books,
        preferred,
        title: pickLocalizedText(preferred, preferred?.title || preferred?.id || ''),
        author: inferBookAuthor(preferred),
        domain: preferred?.taxonomyDomain || preferred?.discipline || 'other'
      };
    });
  }

  function stripLeadingHierarchyNumber(title = '') {
    return String(title).replace(/^\s*\d+(?:\.\d+)*[\s、.)-]*/, '').trim();
  }

  function initLibraryDatabase(bookGraph) {
    if (document.body.dataset.page !== 'library') {
      return;
    }

    const rows = document.querySelector('[data-library-book-rows]');
    const search = document.querySelector('[data-library-search]');
    const domainButtons = Array.from(document.querySelectorAll('[data-library-domain-filter]'));

    if (!rows || !search || !domainButtons.length) {
      return;
    }

    const books = createBookGroups(bookGraph);
    let activeDomain = 'all';

    function matchesBook(book, query) {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      const title = pickLocalizedText(book, '').toLowerCase();
      const author = inferBookAuthor(book).toLowerCase();
      return title.includes(normalized) || author.includes(normalized);
    }

    function renderRows() {
      const query = search.value || '';
      const visible = books.filter((book) => {
        const domainPass = activeDomain === 'all' || (book.domain || 'other') === activeDomain;
        const queryPass = matchesBook(book, query);
        return domainPass && queryPass;
      });

      if (!visible.length) {
        rows.innerHTML = `<tr><td colspan="2" class="muted">${currentLang === 'en' ? 'No books found.' : '没有匹配的书籍。'}</td></tr>`;
        return;
      }

      rows.innerHTML = visible.map((book) => {
        const bookId = encodeURIComponent(book.id);
        return `
          <tr class="library-row" data-book-jump="${bookId}" tabindex="0" role="button">
            <td>${escapeHtml(book.title)}</td>
            <td>${escapeHtml(book.author)}</td>
          </tr>
        `;
      }).join('');
    }

    rows.onclick = (event) => {
      const row = event.target.closest('[data-book-jump]');
      if (!row) return;
      window.location.href = `book.html?book=${row.dataset.bookJump}`;
    };

    rows.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('[data-book-jump]');
      if (!row) return;
      event.preventDefault();
      window.location.href = `book.html?book=${row.dataset.bookJump}`;
    };

    search.oninput = () => renderRows();

    domainButtons.forEach((button) => {
      button.onclick = () => {
        activeDomain = button.dataset.libraryDomainFilter || 'all';
        domainButtons.forEach((item) => item.classList.remove('is-active'));
        button.classList.add('is-active');
        document.body.classList.remove('library-sidebar-open');
        renderRows();
      };
    });

    const activeButton = domainButtons.find((button) => button.classList.contains('is-active'));
    activeDomain = activeButton?.dataset.libraryDomainFilter || 'all';
    renderRows();
  }

  function initBookHierarchyPage(bookGraph) {
    if (document.body.dataset.page !== 'book-detail') {
      return;
    }

    const titleEl = document.querySelector('[data-book-title]');
    const authorEl = document.querySelector('[data-book-author]');
    const disciplineEl = document.querySelector('[data-book-discipline]');
    const treeRoot = document.querySelector('[data-book-tree]');
    if (!titleEl || !authorEl || !disciplineEl || !treeRoot) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const target = params.get('book');
    const groups = createBookGroups(bookGraph);
    const selectedGroup = groups.find((group) => {
      if (group.id === target) return true;
      return group.books.some((item) => {
        const candidates = [item.bookId, item.rawId, item.id, `book:${item.bookId}`, `book:${item.rawId}`].filter(Boolean);
        return candidates.includes(target);
      });
    }) || groups[0];

    if (!selectedGroup) {
      treeRoot.innerHTML = `<li class="muted">${currentLang === 'en' ? 'No book available.' : '暂无可展示书籍。'}</li>`;
      return;
    }

    const nodeMap = new Map((bookGraph.nodes || []).map((node) => [node.id, node]));
    const edges = bookGraph.edges || [];

    function childrenOf(sourceIds, type) {
      const sourceSet = new Set(Array.isArray(sourceIds) ? sourceIds : [sourceIds]);
      const result = [];
      const seen = new Set();

      edges.forEach((edge) => {
        if (!sourceSet.has(edge.source) || edge.type !== type) return;
        const node = nodeMap.get(edge.target);
        if (!node || seen.has(node.id)) return;
        seen.add(node.id);
        result.push(node);
      });

      return result;
    }

    function createLeaf(text) {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }

    function createToggleBranch(text, childList) {
      const li = document.createElement('li');
      li.className = 'book-tree-branch';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'book-tree-toggle';
      toggle.textContent = '▸';
      toggle.setAttribute('aria-expanded', 'false');

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'book-tree-label';
      label.textContent = text;

      const header = document.createElement('div');
      header.className = 'book-tree-item';
      header.append(toggle, label);

      childList.classList.add('book-tree-children');
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        toggle.textContent = expanded ? '▸' : '▾';
        childList.classList.toggle('is-open', !expanded);
      });

      label.addEventListener('click', () => {
        toggle.click();
      });

      li.append(header, childList);
      return li;
    }

    const hierarchyBooks = selectedGroup.id === 'merged-book-ai-aima'
      ? selectedGroup.books.filter((book) => String(book.bookId || '').startsWith('book-pdf-'))
      : selectedGroup.books;

    const bookNodeIds = hierarchyBooks
      .map((book) => book.id)
      .filter(Boolean);
    const chapters = childrenOf(bookNodeIds, 'has_chapter');

    titleEl.textContent = selectedGroup.title;
    authorEl.textContent = selectedGroup.author;
    disciplineEl.textContent = disciplineName(selectedGroup.domain || 'other');

    if (!chapters.length) {
      treeRoot.innerHTML = `<li class="muted">${currentLang === 'en' ? 'No chapter hierarchy found.' : '未找到章节结构。'}</li>`;
      return;
    }

    treeRoot.innerHTML = '';

    chapters.forEach((chapter, chapterIndex) => {
      const sectionList = document.createElement('ul');

      const sections = childrenOf(chapter.id, 'has_section');
      sections.forEach((section, sectionIndex) => {
        const knowledgeList = document.createElement('ul');
        const knowledgeNodes = childrenOf(section.id, 'covers_knowledge');

        if (!knowledgeNodes.length) {
          knowledgeList.append(createLeaf(currentLang === 'en' ? 'No knowledge points' : '暂无知识点'));
        } else {
          knowledgeNodes.forEach((knowledge, knowledgeIndex) => {
            const prefix = `${chapterIndex + 1}.${sectionIndex + 1}.${knowledgeIndex + 1}`;
            const title = stripLeadingHierarchyNumber(pickLocalizedText(knowledge, knowledge.id));
            knowledgeList.append(createLeaf(`${prefix} ${title}`));
          });
        }

        const sectionPrefix = `${chapterIndex + 1}.${sectionIndex + 1}`;
        const sectionTitle = stripLeadingHierarchyNumber(pickLocalizedText(section, section.id));
        sectionList.append(createToggleBranch(`${sectionPrefix} ${sectionTitle}`, knowledgeList));
      });

      if (!sections.length) {
        sectionList.append(createLeaf(currentLang === 'en' ? 'No sections' : '暂无小节'));
      }

      const chapterPrefix = `${chapterIndex + 1}`;
      const chapterTitle = stripLeadingHierarchyNumber(pickLocalizedText(chapter, chapter.id));
      treeRoot.append(createToggleBranch(`${chapterPrefix}. ${chapterTitle}`, sectionList));
    });
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) {
        link.classList.add('active');
      }
    });
    // Active chip styling can change width and trigger overflow after initial nav sync.
    resyncTopNavOverflow?.();
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

    updateSidebarCollapseButton(
      document.querySelector('[data-sidebar-collapse]'),
      document.querySelector('[data-sidebar-toggle-text]'),
      'knowledge-sidebar-collapsed'
    );
    updateSidebarCollapseButton(
      document.querySelector('[data-library-sidebar-collapse]'),
      document.querySelector('[data-library-sidebar-toggle-text]'),
      'library-sidebar-collapsed'
    );
    updateSidebarCollapseButton(
      document.querySelector('[data-project-sidebar-collapse]'),
      document.querySelector('[data-project-sidebar-toggle-text]'),
      'project-sidebar-collapsed'
    );

    document.dispatchEvent(new CustomEvent('kg:themechange', {
      detail: { theme }
    }));
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

  function updateRefreshButtonState() {
    const refreshButton = document.querySelector('[data-refresh-graph]');
    const refreshLabel = document.querySelector('[data-refresh-label]');
    if (!refreshButton || !refreshLabel) {
      return;
    }

    refreshButton.disabled = isRefreshingGraphData;
    refreshLabel.textContent = isRefreshingGraphData ? t('refreshingData') : t('refreshData');
    const label = isRefreshingGraphData ? t('refreshingData') : t('refreshData');
    refreshButton.setAttribute('aria-label', label);
    refreshButton.setAttribute('title', label);
  }

  async function refreshGraphData() {
    if (isRefreshingGraphData) {
      return;
    }

    isRefreshingGraphData = true;
    updateRefreshButtonState();

    try {
      cachedGraph = null;
      const rawGraph = await loadGraph();
      const knowledgeGraph = normalizeKnowledgeGraphPayload(rawGraph);
      const bookGraph = normalizeBookGraphPayload(rawGraph);

      renderHomeStats(knowledgeGraph);
      renderLatestKnowledge(knowledgeGraph.nodes);
      renderKnowledgeExplorer(knowledgeGraph);
      initLibraryDatabase(bookGraph);
      initBookHierarchyPage(bookGraph);

      document.dispatchEvent(new CustomEvent('kg:datarefresh'));
    } catch (error) {
      console.error(error);
      document.querySelectorAll('[data-latest-knowledge], [data-node-list], [data-node-detail], [data-library-book-rows], [data-book-tree]').forEach((element) => {
        if (element) {
          element.innerHTML = `<div class="empty-state">${t('graphLoadError')}</div>`;
        }
      });
    } finally {
      isRefreshingGraphData = false;
      updateRefreshButtonState();
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
    updateRefreshButtonState();
    updateTopNavToggle();
    resyncTopNavOverflow?.();

    document.dispatchEvent(new CustomEvent('kg:languagechange', {
      detail: { lang: currentLang }
    }));
  }

  function setLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
    applyLanguage();

    if (cachedGraph) {
      const knowledgeGraph = normalizeKnowledgeGraphPayload(cachedGraph);
      const bookGraph = normalizeBookGraphPayload(cachedGraph);
      renderLatestKnowledge(knowledgeGraph.nodes);
      renderKnowledgeExplorer(knowledgeGraph);
      initLibraryDatabase(bookGraph);
      initBookHierarchyPage(bookGraph);
    }
  }

  function initControls() {
    initTopNavCollapse();

    const navControls = document.querySelector('.nav-controls');
    if (navControls && !navControls.querySelector('[data-refresh-graph]')) {
      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'icon-btn';
      refreshButton.setAttribute('data-refresh-graph', '');
      refreshButton.innerHTML = '<i class="fas fa-rotate" aria-hidden="true"></i><span data-refresh-label></span>';
      navControls.prepend(refreshButton);
    }

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

    const refreshButton = document.querySelector('[data-refresh-graph]');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        refreshGraphData();
      });
    }

    updateRefreshButtonState();
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
      updateSidebarCollapseButton(
        collapseButton,
        collapseButton?.querySelector('[data-sidebar-toggle-text]'),
        'knowledge-sidebar-collapsed'
      );
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

  function initLibraryDomainTree() {
    if (document.body.dataset.page !== 'library') {
      return;
    }

    const collapseButton = document.querySelector('[data-library-sidebar-collapse]');
    const openButton = document.querySelector('[data-library-sidebar-open]');
    const backdrop = document.querySelector('[data-library-sidebar-backdrop]');
    const toggles = document.querySelectorAll('[data-library-domain-toggle]');

    const storedCollapsed = localStorage.getItem(STORAGE_KEYS.librarySidebarCollapsed) === '1';
    document.body.classList.toggle('library-sidebar-collapsed', storedCollapsed);

    function updateSidebarButton() {
      updateSidebarCollapseButton(
        collapseButton,
        collapseButton?.querySelector('[data-library-sidebar-toggle-text]'),
        'library-sidebar-collapsed'
      );
    }

    updateSidebarButton();

    collapseButton?.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('library-sidebar-collapsed');
      localStorage.setItem(STORAGE_KEYS.librarySidebarCollapsed, isCollapsed ? '1' : '0');
      updateSidebarButton();
    });

    openButton?.addEventListener('click', () => {
      document.body.classList.add('library-sidebar-open');
    });

    backdrop?.addEventListener('click', () => {
      document.body.classList.remove('library-sidebar-open');
    });

    toggles.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const group = trigger.closest('[data-library-domain-group]');
        if (!group) return;
        const isOpen = group.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  function initProjectSidebar() {
    if (document.body.dataset.page !== 'projects') {
      return;
    }

    const collapseButton = document.querySelector('[data-project-sidebar-collapse]');
    const openButton = document.querySelector('[data-project-sidebar-open]');
    const backdrop = document.querySelector('[data-project-sidebar-backdrop]');
    const toggles = document.querySelectorAll('[data-project-domain-toggle]');

    const storedCollapsed = localStorage.getItem(STORAGE_KEYS.projectSidebarCollapsed) === '1';
    document.body.classList.toggle('project-sidebar-collapsed', storedCollapsed);

    function updateSidebarButton() {
      updateSidebarCollapseButton(
        collapseButton,
        collapseButton?.querySelector('[data-project-sidebar-toggle-text]'),
        'project-sidebar-collapsed'
      );
    }

    updateSidebarButton();

    collapseButton?.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('project-sidebar-collapsed');
      localStorage.setItem(STORAGE_KEYS.projectSidebarCollapsed, isCollapsed ? '1' : '0');
      updateSidebarButton();
    });

    openButton?.addEventListener('click', () => {
      document.body.classList.add('project-sidebar-open');
    });

    backdrop?.addEventListener('click', () => {
      document.body.classList.remove('project-sidebar-open');
    });

    toggles.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const group = trigger.closest('[data-project-domain-group]');
        if (!group) return;
        const isOpen = group.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  function initProjectFilters() {
    if (document.body.dataset.page !== 'projects') {
      return;
    }

    const filterButtons = Array.from(document.querySelectorAll('[data-project-filter]'));
    const cards = Array.from(document.querySelectorAll('[data-project-card]'));
    const sections = Array.from(document.querySelectorAll('[data-project-section]'));

    if (!filterButtons.length || !cards.length) {
      return;
    }

    const matchesCard = (card, filter) => {
      if (filter === 'all') return true;
      const categories = String(card.dataset.projectCategories || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return categories.includes(filter);
    };

    const render = (filter) => {
      cards.forEach((card) => {
        card.hidden = !matchesCard(card, filter);
      });

      sections.forEach((section) => {
        const sectionCards = Array.from(section.querySelectorAll('[data-project-card]'));
        const hasVisible = sectionCards.some((card) => !card.hidden);
        section.hidden = !hasVisible;
      });
    };

    filterButtons.forEach((button) => {
      button.onclick = () => {
        const filter = button.dataset.projectFilter || 'all';
        filterButtons.forEach((item) => item.classList.remove('is-active'));
        button.classList.add('is-active');
        render(filter);
        document.body.classList.remove('project-sidebar-open');
      };
    });

    const activeButton = filterButtons.find((button) => button.classList.contains('is-active'));
    render(activeButton?.dataset.projectFilter || 'all');
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

    if ((node.taxonomyDomain || '').toLowerCase() === domainFilter.toLowerCase()) {
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

    const nodes = graph.nodes.filter((node) => node.type !== 'project' && node.type !== 'source');
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

      const formatSourceItem = (source) => {
        const bookTitle = source.bookTitleI18n?.[currentLang] || source.bookTitleI18n?.zh || source.bookTitle || source.bookId || '';
        const chapterTitle = source.chapterI18n?.[currentLang] || source.chapterI18n?.zh || source.chapter || '';
        const sectionTitle = source.sectionI18n?.[currentLang] || source.sectionI18n?.zh || source.section || '';
        const locator = [bookTitle, chapterTitle, sectionTitle].filter(Boolean).join(' · ');
        const link = source.link ? `<a class="inline-link" href="${escapeHtml(source.link)}" target="_blank" rel="noopener">${t('openMarkdown')} <span aria-hidden="true">→</span></a>` : '';
        return `
          <li>
            <strong>${escapeHtml(source.type || 'defined_in')}</strong>
            ${locator ? `<p class="muted">${escapeHtml(locator)}</p>` : ''}
            ${link}
          </li>
        `;
      };

      const sourceByRelation = (relationType) => {
        return (node.provenanceLinks || []).filter((item) => item.type === relationType);
      };

      const definedIn = sourceByRelation('defined_in');
      const supportedBy = sourceByRelation('support');
      const citedFrom = sourceByRelation('cite_from');

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
          <h4>${t('definitionSource')}</h4>
          <ul class="mini-list">${definedIn.map((item) => formatSourceItem(item)).join('') || `<li>${t('noSourceRefs')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('supportingSources')}</h4>
          <ul class="mini-list">${supportedBy.map((item) => formatSourceItem(item)).join('') || `<li>${t('noSourceRefs')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('citedSources')}</h4>
          <ul class="mini-list">${citedFrom.map((item) => formatSourceItem(item)).join('') || `<li>${t('noSourceRefs')}</li>`}</ul>
        </div>
        <div class="detail-section">
          <h4>${t('sourceNode')}</h4>
          ${node.provenanceLinks?.[0]?.link
            ? `<a class="inline-link" href="${escapeHtml(node.provenanceLinks[0].link)}" target="_blank" rel="noopener">${t('openMarkdown')} <span aria-hidden="true">→</span></a>`
            : `<span class="muted">${t('noSourceRefs')}</span>`}
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

        if (selected === 'all') {
          activeDomainFilter = 'all';
          button.classList.add('is-active');
        } else {
          activeDomainFilter = isAlreadyActive ? 'all' : selected;
          if (activeDomainFilter === 'all') {
            const allButton = domainButtons.find((item) => (item.dataset.domainFilter || '') === 'all');
            allButton?.classList.add('is-active');
          } else {
            button.classList.add('is-active');
          }
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
    initLibraryDomainTree();
    initProjectSidebar();
    initProjectFilters();
    setActiveNav();

    const latest = document.querySelector('[data-latest-knowledge]');
    if (latest) {
      latest.innerHTML = t('loadingLatest');
    }

    try {
      const rawGraph = await loadGraph();
      const knowledgeGraph = normalizeKnowledgeGraphPayload(rawGraph);
      const bookGraph = normalizeBookGraphPayload(rawGraph);

      renderHomeStats(knowledgeGraph);
      renderLatestKnowledge(knowledgeGraph.nodes);
      renderKnowledgeExplorer(knowledgeGraph);
      initLibraryDatabase(bookGraph);
      initBookHierarchyPage(bookGraph);
    } catch (error) {
      console.error(error);
      document.querySelectorAll('[data-latest-knowledge], [data-node-list], [data-node-detail], [data-library-book-rows], [data-book-tree]').forEach((element) => {
        if (element) {
          element.innerHTML = `<div class="empty-state">${t('graphLoadError')}</div>`;
        }
      });
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', KnowledgeGraphSite.init);
