import Graph from 'graphology';
import { loadTerms, loadMorphemes } from './loader.js';

export function buildGraph(filterFn = null) {
  const terms = loadTerms();
  const morphemes = loadMorphemes();
  const graph = new Graph({ multi: false, type: 'directed' });

  const filtered = filterFn ? terms.filter(filterFn) : terms;

  for (const term of filtered) {
    const termNode = `term:${term.id}`;
    graph.addNode(termNode, {
      type: 'term',
      label: term.english,
      chinese: term.chinese,
      chapter: term.chapter || ''
    });

    for (const morphemeId of term.morphemes) {
      const morphemeNode = `morph:${morphemeId}`;
      if (!graph.hasNode(morphemeNode)) {
        const m = morphemes[morphemeId] || {};
        graph.addNode(morphemeNode, {
          type: 'morpheme',
          label: morphemeId,
          meaning: m.meaning ?? '?',
          chinese: m.chinese ?? ''
        });
      }
      graph.addEdge(morphemeNode, termNode, { relation: 'composes' });
    }
  }

  return graph;
}

export function exportToCytoscape(graph) {
  const nodes = [];
  const edges = [];

  graph.forEachNode((id, attrs) => {
    nodes.push({
      data: {
        id,
        label: attrs.label,
        type: attrs.type,
        chinese: attrs.chinese,
        meaning: attrs.meaning,
        chapter: attrs.chapter
      }
    });
  });

  graph.forEachEdge((edgeId, attrs, source, target) => {
    edges.push({
      data: {
        id: edgeId,
        source,
        target,
        relation: attrs.relation
      }
    });
  });

  return { nodes, edges };
}