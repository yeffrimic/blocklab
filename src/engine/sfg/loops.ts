import type { Sfg, SfgEdge, WeightedWalk } from './types.ts';
import { maskOf } from './build.ts';
import { walkWeight } from './weight.ts';

/**
 * Lazos elementales por el algoritmo de Johnson (1975).
 * Un DFS ingenuo repetiría cada ciclo en todas sus rotaciones; Johnson emite
 * cada ciclo elemental exactamente una vez, en O((n + e)(c + 1)).
 *
 * Johnson trabaja sobre el grafo simple; las aristas paralelas se expanden
 * después, porque dos ramas entre el mismo par de nodos son lazos distintos
 * con ganancias distintas pero el mismo conjunto de nodos.
 */
export function elementaryLoops(sfg: Sfg): WeightedWalk[] {
  const ids = sfg.nodes;
  const n = ids.length;
  const idx = sfg.index;

  const parallel = new Map<string, SfgEdge[]>();
  const succ: number[][] = Array.from({ length: n }, () => []);
  for (const e of sfg.edges) {
    const a = idx.get(e.from)!;
    const b = idx.get(e.to)!;
    const key = `${a}>${b}`;
    const list = parallel.get(key);
    if (list) list.push(e);
    else {
      parallel.set(key, [e]);
      succ[a]!.push(b);
    }
  }

  const nodeCycles = johnson(n, succ);

  const loops: WeightedWalk[] = [];
  for (const cycle of nodeCycles) {
    const choices = cycle.map((v, i) => parallel.get(`${v}>${cycle[(i + 1) % cycle.length]}`)!);
    for (const combo of cartesian(choices)) {
      const nodes = cycle.map((v) => ids[v]!);
      loops.push({
        nodes,
        edges: combo,
        gain: walkWeight(combo),
        mask: maskOf(idx, nodes),
      });
    }
  }
  return loops;
}

function cartesian(lists: SfgEdge[][]): SfgEdge[][] {
  let acc: SfgEdge[][] = [[]];
  for (const list of lists) {
    const next: SfgEdge[][] = [];
    for (const prefix of acc) for (const e of list) next.push([...prefix, e]);
    acc = next;
  }
  return acc;
}

/** Ciclos elementales como listas de índices de nodo, sin repetir rotaciones. */
function johnson(n: number, succ: number[][]): number[][] {
  const cycles: number[][] = [];
  const blocked = new Array<boolean>(n).fill(false);
  let B: Set<number>[] = Array.from({ length: n }, () => new Set());
  const stack: number[] = [];
  let start = 0;
  let sub: number[][] = [];

  const unblock = (u: number): void => {
    blocked[u] = false;
    for (const w of [...B[u]!]) {
      B[u]!.delete(w);
      if (blocked[w]!) unblock(w);
    }
  };

  const circuit = (v: number): boolean => {
    let found = false;
    stack.push(v);
    blocked[v] = true;
    for (const w of sub[v]!) {
      if (w === start) {
        cycles.push([...stack]);
        found = true;
      } else if (!blocked[w]!) {
        if (circuit(w)) found = true;
      }
    }
    if (found) unblock(v);
    else for (const w of sub[v]!) B[w]!.add(v);
    stack.pop();
    return found;
  };

  for (start = 0; start < n; start++) {
    sub = succ.map((list, i) => (i < start ? [] : list.filter((w) => w >= start)));
    blocked.fill(false);
    B = Array.from({ length: n }, () => new Set());
    circuit(start);
  }
  return cycles;
}
