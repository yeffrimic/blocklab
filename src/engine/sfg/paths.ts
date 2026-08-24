import type { Sfg, SfgEdge, WeightedWalk } from './types.ts';
import { maskOf } from './build.ts';
import { walkWeight } from './weight.ts';

/**
 * Caminos directos: DFS de `source` a `sink` sin repetir nodos.
 * Se recorre sobre aristas (no sobre nodos) para que dos ramas paralelas entre
 * el mismo par de nodos cuenten como dos caminos distintos.
 */
export function forwardPaths(sfg: Sfg, limit = 5000): WeightedWalk[] {
  const out: WeightedWalk[] = [];
  const adj = new Map<string, SfgEdge[]>();
  for (const e of sfg.edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e);

  const nodeStack: string[] = [sfg.source];
  const edgeStack: SfgEdge[] = [];
  const onPath = new Set<string>([sfg.source]);

  const walk = (v: string): void => {
    if (out.length >= limit) return;
    if (v === sfg.sink) {
      out.push({
        nodes: [...nodeStack],
        edges: [...edgeStack],
        gain: walkWeight(edgeStack),
        mask: maskOf(sfg.index, nodeStack),
      });
      return;
    }
    for (const e of adj.get(v) ?? []) {
      if (onPath.has(e.to)) continue;
      onPath.add(e.to);
      nodeStack.push(e.to);
      edgeStack.push(e);
      walk(e.to);
      edgeStack.pop();
      nodeStack.pop();
      onPath.delete(e.to);
    }
  };

  walk(sfg.source);
  return out;
}
