const KnowledgeGraphSite = (() => {
  let cachedGraph = null;

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

  function renderLatestKnowledge(nodes) {
    const container = document.querySelector('[data-latest-knowledge]');
    if (!container) {
      return;
    }
    const latest = nodes.filter((node) => node.type !== 'project').slice(0, 4);
    if (latest.length === 0) {
      container.innerHTML = '<div class="empty-state">No knowledge nodes yet.</div>';
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
        <a class="inline-link" href="knowledge.html?node=${encodeURIComponent(node.id)}">Read in Knowledge <span aria-hidden="true">→</span></a>
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
    let activeFilter = 'all';
    let activeId = new URLSearchParams(window.location.search).get('node') || nodes[0]?.id || null;

    function getVisibleNodes() {
      const query = input.value || '';
      return nodes.filter((node) => nodeMatches(node, query, activeFilter));
    }

    function renderDetail(node) {
      if (!node) {
        detail.innerHTML = '<div class="empty-state">No matching node. Try another filter or search keyword.</div>';
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
        ${aliases ? `<p class="muted"><strong>Aliases:</strong> ${escapeHtml(aliases)}</p>` : ''}
        <div class="post-meta">${tags}</div>
        <div class="detail-section">
          <h4>Learning objective</h4>
          <p>${escapeHtml(node.learningObjective || 'No learning objective yet.')}</p>
        </div>
        <div class="detail-section">
          <h4>Common errors</h4>
          <ul class="mini-list">${errors || '<li>None recorded yet.</li>'}</ul>
        </div>
        <div class="detail-section">
          <h4>Verification steps</h4>
          <ul class="mini-list">${steps || '<li>No verification steps yet.</li>'}</ul>
        </div>
        <div class="detail-section">
          <h4>Related project evidence</h4>
          <ul class="link-list">${projectLinks || '<li class="muted">No linked project evidence yet.</li>'}</ul>
        </div>
        <div class="detail-section">
          <h4>Source node file</h4>
          <a class="inline-link" href="${escapeHtml(node.sourcePath || '#')}">Open Markdown node <span aria-hidden="true">→</span></a>
        </div>
      `;
    }

    function renderList() {
      const visibleNodes = getVisibleNodes();
      if (!visibleNodes.some((node) => node.id === activeId)) {
        activeId = visibleNodes[0]?.id || null;
      }

      if (visibleNodes.length === 0) {
        list.innerHTML = '<div class="empty-state">No nodes found. Try a broader keyword.</div>';
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

    renderList();
  }

  async function init() {
    setActiveNav();
    try {
      const graph = await loadGraph();
      renderHomeStats(graph);
      renderLatestKnowledge(graph.nodes);
      renderKnowledgeExplorer(graph);
    } catch (error) {
      console.error(error);
      document.querySelectorAll('[data-latest-knowledge], [data-node-list], [data-node-detail]').forEach((element) => {
        if (element) {
          element.innerHTML = '<div class="empty-state">Unable to load graph data right now.</div>';
        }
      });
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', KnowledgeGraphSite.init);
