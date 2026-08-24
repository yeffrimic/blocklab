import type { Diagram, DiagramEdge, NodeId, Sign } from '../types.ts';
import type { Sfg, SfgEdge } from './types.ts';

export class SfgBuildError extends Error {}

/**
 * Diagrama -> SFG. Un bloque deja de ser un nodo y se convierte en una arista con
 * ganancia; las cascadas de bloques colapsan en una sola arista con el producto.
 * Asume un diagrama que ya pasó `validate`.
 */
export function buildSfg(d: Diagram): Sfg {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const outOf = new Map<NodeId, DiagramEdge[]>();
  for (const e of d.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) {
      throw new SfgBuildError(`La arista ${e.id} apunta a un nodo inexistente`);
    }
    (outOf.get(e.from) ?? outOf.set(e.from, []).get(e.from)!).push(e);
  }

  const source = d.nodes.find((n) => n.kind === 'source');
  const sink = d.nodes.find((n) => n.kind === 'sink');
  if (!source) throw new SfgBuildError('El diagrama no tiene entrada');
  if (!sink) throw new SfgBuildError('El diagrama no tiene salida');

  const sfgNodes = d.nodes.filter((n) => n.kind !== 'block').map((n) => n.id);
  const index = new Map(sfgNodes.map((id, i) => [id, i]));
  const edges: SfgEdge[] = [];

  for (const start of d.nodes) {
    if (start.kind === 'block') continue;
    for (const first of outOf.get(start.id) ?? []) {
      const gain: string[] = [];
      const viaEdges: string[] = [];
      const viaBlocks: NodeId[] = [];
      let cur: DiagramEdge = first;

      for (let guard = 0; ; guard++) {
        if (guard > d.nodes.length + 1) {
          throw new SfgBuildError('Cadena de bloques sin nodo de señal (ciclo cerrado de bloques)');
        }
        viaEdges.push(cur.id);
        const target = byId.get(cur.to)!;
        if (target.kind !== 'block') break;
        gain.push(target.gain);
        viaBlocks.push(target.id);
        const next = outOf.get(target.id) ?? [];
        if (next.length !== 1) {
          throw new SfgBuildError(
            `El bloque ${target.gain} debe tener exactamente una salida (tiene ${next.length})`,
          );
        }
        cur = next[0]!;
      }

      const end = byId.get(cur.to)!;
      let sign: Sign = 1;
      if (end.kind === 'sum') {
        const port = end.ports.find((p) => p.id === cur.toPort);
        if (!port) throw new SfgBuildError(`La arista ${cur.id} no indica un puerto válido del sumador`);
        sign = port.sign;
      }

      edges.push({
        id: `sfg:${viaEdges.join('|')}`,
        from: start.id,
        to: end.id,
        gain,
        sign,
        via: { edges: viaEdges, blocks: viaBlocks },
      });
    }
  }

  return { nodes: sfgNodes, edges, source: source.id, sink: sink.id, index };
}

export const maskOf = (index: Map<NodeId, number>, nodes: Iterable<NodeId>): bigint => {
  let m = 0n;
  for (const n of nodes) m |= 1n << BigInt(index.get(n)!);
  return m;
};
