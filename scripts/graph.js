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
    collapsedBookNodes: new Set()
  };

  const EL = {};

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

  function matchesSearch(node) {
    if (!state.search.trim()) return true;
    const q = state.search.trim().toLowerCase();
    const content = [
      node.id,
      node.rawId,
      node.title,
      node.summary,
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
          .map((p) => `<li><strong>${p.type}</strong> → <a href="${p.link || 'graph/source.json'}" target="_blank" rel="noopener">${p.bookTitle} › ${p.chapter} › ${p.section}</a></li>`)
          .join('')
      : '<li>暂无来源链接</li>';

    return `
      <div style="max-width:360px;line-height:1.45;">
        <div><strong>${node.title}</strong></div>
        <div>${node.summary || ''}</div>
        <div style="margin-top:6px;"><strong>来源关系</strong>（tooltip-only）</div>
        <ul style="margin:6px 0 0 16px;padding:0;">${linksHtml}</ul>
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
      const tooltip = state.mode === 'knowledge' ? buildKnowledgeTooltip(node) : `${node.title}\n${node.type}`;

      return {
        id,
        label: node.title,
        title: tooltip,
        shape: 'dot',
        size: Math.max(12, 12 + Math.log2(1 + degree) * 4),
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
      id: `${edge.source}-${edge.type}-${edge.target}`,
      from: edge.source,
      to: edge.target,
      arrows: 'to',
      label: edge.type,
      color: {
        color: edgeColorByType(edge.type),
        highlight: cssVar('--accent', '#2563eb')
      },
      width: state.mode === 'book' ? 2.2 : 1.8,
      dashes: edge.type === 'related_to',
      smooth: true,
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
        <p class="muted">当前为 ${state.mode === 'book' ? '书籍模式' : '知识模式'}。点击任意节点查看详情。</p>
      `;
      return;
    }

    const incoming = getIncomingEdges(node.id);
    const outgoing = getOutgoingEdges(node.id);

    const relationList = (list, dir) => {
      if (!list.length) return '<li class="muted">无</li>';
      return list
        .map((edge) => {
          const peerId = dir === 'out' ? edge.target : edge.source;
          const peer = nodeMap.get(peerId);
          return `<li><strong>${peer?.title || peerId}</strong><span class="note-inline">${edge.type}</span><p class="muted">${edge.reason || ''}</p></li>`;
        })
        .join('');
    };

    const provenance = (node.provenanceLinks || []).length
      ? node.provenanceLinks
          .map((p) => `<li><strong>${p.type}</strong> · <a class="inline-link" href="${p.link || 'graph/source.json'}" target="_blank" rel="noopener">${p.bookTitle} › ${p.chapter} › ${p.section}</a></li>`)
          .join('')
      : '<li class="muted">无</li>';

    EL.detail.innerHTML = `
      <div class="detail-meta">
        <span class="badge">${node.type}</span>
        ${node.difficulty ? `<span class="badge">${node.difficulty}</span>` : ''}
        ${node.discipline ? `<span class="badge">${node.discipline}</span>` : ''}
      </div>
      <h2>${node.title}</h2>
      <p>${node.summary || ''}</p>
      <div class="detail-section">
        <h4>Outgoing</h4>
        <ul class="mini-list">${relationList(outgoing, 'out')}</ul>
      </div>
      <div class="detail-section">
        <h4>Incoming</h4>
        <ul class="mini-list">${relationList(incoming, 'in')}</ul>
      </div>
      ${state.mode === 'knowledge' ? `
      <div class="detail-section">
        <h4>来源关系（tooltip-only）</h4>
        <ul class="mini-list">${provenance}</ul>
      </div>` : ''}
    `;
  }

  function renderLegend() {
    if (!EL.legend) return;
    const view = getCurrentView();
    const types = [...new Set((view?.nodes || []).map((n) => n.type))].sort();

    EL.legend.innerHTML = types
      .map((type) => {
        const sampleNode = (view?.nodes || []).find((n) => n.type === type) || { type };
        const color = nodeColorByType(sampleNode);
        return `<span><i class="legend-dot" style="background:${color}"></i> ${type}</span>`;
      })
      .join('');
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
        return `<button class="filter-chip ${active}" type="button" data-node-type="${type}">${type}</button>`;
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
            <span>${type}</span>
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
      return { title: 'Nodes missing defined_in provenance', ids };
    }

    if (kind === 'weak-support') {
      const ids = new Set(
        nodes
          .filter((node) => (node.provenanceLinks || []).filter((p) => p.type === 'support').length < 1)
          .map((node) => node.id)
      );
      return { title: 'Nodes with weak support provenance', ids };
    }

    if (kind === 'top-degree') {
      const degree = new Map(nodes.map((n) => [n.id, 0]));
      for (const edge of edges) {
        degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
        degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
      }
      const top = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { title: 'Top degree knowledge nodes', ids: new Set(top.map(([id]) => id)) };
    }

    return { title: 'Query cleared', ids: new Set() };
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
          return `<li><button class="graph-query-node" type="button" data-focus-node="${id}">${node?.title || id}</button></li>`;
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
      renderQueryResults('Book mode active (queries paused)', new Set());
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
          renderQueryResults('Switch to knowledge mode to run queries', new Set());
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
        EL.canvas.innerHTML = `<div class="empty-state">Graph renderer failed to load. Please check network access to CDN resources.</div>`;
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
      refreshModeUI();
      renderQueryResults('Ready', new Set());
    } catch (error) {
      console.error(error);
      if (EL.detail) {
        EL.detail.innerHTML = `<h2>Node details</h2><p class="muted">Unable to load graph data.</p>`;
      }
      if (EL.canvas) {
        EL.canvas.innerHTML = `<div class="empty-state">Unable to load graph data.</div>`;
      }
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', GraphWorkspace.init);
