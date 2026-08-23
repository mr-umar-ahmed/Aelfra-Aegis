import { ProcessNode, EventEdge } from "./types";

/**
 * Positions graph nodes in a clean, spacious horizontal hierarchy (Left-to-Right layout)
 * with generous vertical and horizontal spacing to prevent congestion.
 */
export function autoLayoutNodes(nodes: ProcessNode[], edges: EventEdge[]): ProcessNode[] {
  const levels: Record<number, string[]> = {};

  // Map children relationships
  const parents: Record<string, string> = {};
  edges.forEach((edge) => {
    parents[edge.target] = edge.source;
  });

  // Assign depths
  nodes.forEach((node) => {
    let depth = 0;
    let curr = node.id;
    while (parents[curr]) {
      depth++;
      curr = parents[curr];
      if (depth > 20) break; // prevent infinite loops
    }

    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node.id);
  });

  const nodeWidth = 320;  // Generous horizontal spacing
  const nodeHeight = 200; // Generous vertical spacing

  return nodes.map((node) => {
    let depth = 0;
    let curr = node.id;
    while (parents[curr]) {
      depth++;
      curr = parents[curr];
      if (depth > 20) break;
    }

    const levelNodes = levels[depth] || [node.id];
    const indexInLevel = levelNodes.indexOf(node.id);

    return {
      ...node,
      position: {
        x: 100 + depth * nodeWidth,
        y: 80 + indexInLevel * nodeHeight,
      },
    };
  });
}
