const GraphWorkspace = (() => {
  const state = {
    graph: null,
    network: null,
    selectedNodeId: null,
    nodeTypeFilters: new Set(),
    edgeTypeFilters: new Set(),
    search: '',
    localDepth: 0,
    queryResultIds: new Set()
  };

  const EL = {};

  const RELATION_COLORS = {
    defined_in: '#f59e0b',
    supported_by: '#22c55e',
    cited_from: '#06b6d4',
    prerequisite_of: '#8b5cf6',
    related_to: '#94a3b8'
  };

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function nodeColorByType(type) {
    const accent = cssVar('--accent', '#2563eb');
    switch (type) {
      case 'concept': return accent;
      case 'skill': return '#8b5cf6';
      case 'source': return '#f59e0b';
      case 'project': return '#14b8a6';
      default: return '#64748b';
    }
  }

  function edgeColorByType(type) {
    return RELATION_COLORS[type] || '#94a3b8';
  }

  function getNodeMap() {
    return new Map(state.graph.nodes.map((n) => [n.id, n]));
  }

  function getIncomingEdges(nodeId) {
    return state.graph.edges.filter((edge) => edge.target === nodeId);
  }

  function getOutgoingEdges(nodeId) {
    return state.graph.edges.filter((edge) => edge.source === nodeId);
  }

  function matchesSearch(node) {
    if (!state.search.trim()) return true;
    const q = state.search.trim().toLowerCase();
    const content = [
      node.id,
      node.title,
      node.summary,
      ...(node.tags || []),
      ...(node.aliases || []),
      ...(node.retrievalKeywords || [])
    ].join(' ').toLowerCase();
    return content.includes(q);
  }

  function getFilteredNodeIds() {
    const ids = new Set(
      state.graph.nodes
        .filter((node) => state.nodeTypeFilters.has(node.type))
        .filter(matchesSearch)
        .map((node) => node.id)
    );

    if (state.queryResultIds.size > 0) {
      return new Set([...ids].filter((id) => state.queryResultIds.has(id)));
    }

    return ids;
  }

  function computeLocalGraph(baseNodeIds, edgeList) {
    if (!state.selectedNodeId || state.localDepth <= 0 || !baseNodeIds.has(state.selectedNodeId)) {
      return baseNodeIds;
    }

    const adjacency = new Map();
    for (const edge of edgeList) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    }

    const visited = new Set([state.selectedNodeId]);
    let frontier = new Set([state.selectedNodeId]);

    for (let depth = 0; depth < state.localDepth; depth += 1) {
      const next = new Set();
      for (const id of frontier) {
        const neighbors = adjacency.get(id) || new Set();
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            next.add(n);
          }
        }
      }
      frontier = next;
      if (frontier.size === 0) break;
    }

    return visited;
  }

  function buildDatasets() {
    const nodeMap = getNodeMap();

    const baseNodeIds = getFilteredNodeIds();
    const baseEdges = state.graph.edges.filter((edge) => state.edgeTypeFilters.has(edge.type) && baseNodeIds.has(edge.source) && baseNodeIds.has(edge.target));
    const localNodeIds = computeLocalGraph(baseNodeIds, baseEdges);
    const edges = baseEdges.filter((edge) => localNodeIds.has(edge.source) && localNodeIds.has(edge.target));

    const nodes = [...localNodeIds].map((id) => {
      const node = nodeMap.get(id);
      const degree = edges.filter((edge) => edge.source === id || edge.target === id).length;
      const isSelected = state.selectedNodeId === id;
      return {
        id,
        label: node.title,
        title: `${node.title}\n${node.type}`,
        shape: 'dot',
        size: Math.max(12, 12 + Math.log2(1 + degree) * 4),
        color: {
          background: nodeColorByType(node.type),
          border: isSelected ? cssVar('--solid-bg', '#111827') : cssVar('--line', '#e4e4e7'),
          highlight: {
            background: nodeColorByType(node.type),
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
      width: edge.type === 'defined_in' ? 2.8 : 1.5,
      dashes: edge.type === 'cited_from',
      smooth: true,
      font: {
        size: 10,
        color: cssVar('--muted', '#52525b')
      }
    }));

    return { nodes, edges: visEdges };
  }

  function renderDetail() {
    if (!EL.detail) return;
    const nodeMap = getNodeMap();
    const node = nodeMap.get(state.selectedNodeId);

    if (!node) {
      EL.detail.innerHTML = `
        <h2>Node details</h2>
        <p class="muted">Click any node in the graph to inspect provenance and backlinks.</p>
      `;
      return;
    }

    const incoming = getIncomingEdges(node.id);
    const outgoing = getOutgoingEdges(node.id);

    const byType = (type) => outgoing.filter((edge) => edge.type === type);
    const renderEdgeList = (edges) => {
      if (!edges.length) return '<li class="muted">None</li>';
      return edges.map((edge) => {
        const target = nodeMap.get(edge.target);
        return `<li><strong>${target?.title || edge.target}</strong><p class="muted">${edge.reason || ''}</p></li>`;
      }).join('');
    };

    const backlinks = incoming.length
      ? incoming.map((edge) => {
          const source = nodeMap.get(edge.source);
          return `<li><strong>${source?.title || edge.source}</strong><span class="note-inline">${edge.type}</span></li>`;
        }).join('')
      : '<li class="muted">No backlinks</li>';

    EL.detail.innerHTML = `
      <div class="detail-meta">
        <span class="badge">${node.type}</span>
        <span class="badge">${node.difficulty || 'unknown'}</span>
      </div>
      <h2>${node.title}</h2>
      <p>${node.summary || ''}</p>

      <div class="detail-section">
        <h4>Definition sources</h4>
        <ul class="mini-list">${renderEdgeList(byType('defined_in'))}</ul>
      </div>
      <div class="detail-section">
        <h4>Supporting sources</h4>
        <ul class="mini-list">${renderEdgeList(byType('supported_by'))}</ul>
      </div>
      <div class="detail-section">
        <h4>Cited sources</h4>
        <ul class="mini-list">${renderEdgeList(byType('cited_from'))}</ul>
      </div>
      <div class="detail-section">
        <h4>Backlinks</h4>
        <ul class="mini-list">${backlinks}</ul>
      </div>
      <div class="detail-section">
        <h4>Node file</h4>
        <a class="inline-link" href="${node.sourcePath || '#'}">Open Markdown node <span aria-hidden="true">→</span></a>
      </div>
    `;
  }

  function syncNetworkSelection() {
    if (state.network && state.selectedNodeId) {
      state.network.selectNodes([state.selectedNodeId]);
      state.network.focus(state.selectedNodeId, { animation: { duration: 350 } });
    }
  }

  function renderNetwork() {
    if (!EL.canvas || !state.graph) return;
    const datasets = buildDatasets();

    if (!state.network) {
      state.network = new vis.Network(
        EL.canvas,
        {
          nodes: new vis.DataSet(datasets.nodes),
          edges: new vis.DataSet(datasets.edges)
        },
        {
          autoResize: true,
          interaction: {
            hover: true,
            zoomView: true,
            dragView: true,
            navigationButtons: true
          },
          physics: {
            enabled: true,
            stabilization: { iterations: 150 }
          },
          nodes: {
            borderWidth: 1.2
          },
          edges: {
            smooth: {
              type: 'dynamic'
            }
          }
        }
      );

      state.network.on('click', (params) => {
        const nodeId = params.nodes?.[0] || null;
        state.selectedNodeId = nodeId;
        renderDetail();
      });
    } else {
      state.network.setData({
        nodes: new vis.DataSet(datasets.nodes),
        edges: new vis.DataSet(datasets.edges)
      });
    }

    renderDetail();
    syncNetworkSelection();
  }

  function renderTypeFilters() {
    const types = [...new Set(state.graph.nodes.map((n) => n.type))].sort();
    EL.nodeTypeFilters.innerHTML = types.map((type) => {
      const active = state.nodeTypeFilters.has(type) ? 'is-active' : '';
      return `<button class="filter-chip ${active}" type="button" data-node-type="${type}">${type}</button>`;
    }).join('');

    EL.nodeTypeFilters.querySelectorAll('[data-node-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.nodeType;
        if (state.nodeTypeFilters.has(type)) {
          state.nodeTypeFilters.delete(type);
        } else {
          state.nodeTypeFilters.add(type);
        }

        if (state.nodeTypeFilters.size === 0) {
          state.nodeTypeFilters = new Set(types);
        }

        renderTypeFilters();
        renderNetwork();
      });
    });
  }

  function renderEdgeFilters() {
    const edgeTypes = [...new Set(state.graph.edges.map((e) => e.type))].sort();
    EL.edgeTypeFilters.innerHTML = edgeTypes.map((type) => {
      const checked = state.edgeTypeFilters.has(type) ? 'checked' : '';
      return `
        <label class="graph-edge-option">
          <input type="checkbox" data-edge-type="${type}" ${checked}>
          <span>${type}</span>
        </label>
      `;
    }).join('');

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
    const nonSource = state.graph.nodes.filter((n) => n.type !== 'source');

    if (kind === 'missing-defined') {
      const ids = new Set(
        nonSource
          .filter((node) => !state.graph.edges.some((edge) => edge.source === node.id && edge.type === 'defined_in'))
          .map((node) => node.id)
      );
      return { title: 'Nodes missing defined_in', ids };
    }

    if (kind === 'weak-support') {
      const ids = new Set(
        nonSource
          .filter((node) => {
            const count = state.graph.edges.filter((edge) => edge.source === node.id && edge.type === 'supported_by').length;
            return count < 1;
          })
          .map((node) => node.id)
      );
      return { title: 'Nodes with weak support', ids };
    }

    if (kind === 'top-degree') {
      const degree = new Map(nonSource.map((node) => [node.id, 0]));
      for (const edge of state.graph.edges) {
        if (degree.has(edge.source)) degree.set(edge.source, degree.get(edge.source) + 1);
        if (degree.has(edge.target)) degree.set(edge.target, degree.get(edge.target) + 1);
      }
      const sorted = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { title: 'Top degree nodes', ids: new Set(sorted.map(([id]) => id)) };
    }

    return { title: 'Query cleared', ids: new Set() };
  }

  function renderQueryResults(title, ids) {
    const nodeMap = getNodeMap();
    if (!ids.size) {
      EL.queryResults.innerHTML = `<li class="muted">${title}</li>`;
      return;
    }

    EL.queryResults.innerHTML = `<li><strong>${title}</strong></li>` + [...ids].map((id) => {
      const n = nodeMap.get(id);
      return `<li><button class="graph-query-node" type="button" data-focus-node="${id}">${n?.title || id}</button></li>`;
    }).join('');

    EL.queryResults.querySelectorAll('[data-focus-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedNodeId = btn.dataset.focusNode;
        state.localDepth = 1;
        EL.depth.value = '1';
        EL.depthLabel.textContent = '1';
        renderNetwork();
      });
    });
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

    document.querySelectorAll('[data-query]').forEach((btn) => {
      btn.addEventListener('click', () => {
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

    try {
      state.graph = await loadGraph();
      state.nodeTypeFilters = new Set(state.graph.nodes.map((n) => n.type));
      state.edgeTypeFilters = new Set(state.graph.edges.map((e) => e.type));
      state.localDepth = Number(EL.depth?.value || 0);

      const selectedFromUrl = new URLSearchParams(window.location.search).get('node');
      if (selectedFromUrl && state.graph.nodes.some((n) => n.id === selectedFromUrl)) {
        state.selectedNodeId = selectedFromUrl;
      }

      renderTypeFilters();
      renderEdgeFilters();
      bindControls();
      renderNetwork();
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
