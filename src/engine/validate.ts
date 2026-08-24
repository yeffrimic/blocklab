import type { Diagram, DiagramEdge, DiagramNode, NodeId } from './types.ts';
import { gainSymbols, parseGain } from './polynomial/parse.ts';

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  code: string;
  /** Mensaje concreto y accionable, nunca genérico. */
  message: string;
  nodes: NodeId[];
  edges: string[];
  /** Reparación de un clic que la UI puede ofrecer junto al mensaje. */
  fix?: { kind: 'declare-symbol'; symbol: string };
}

const label = (n: DiagramNode): string => {
  switch (n.kind) {
    case 'block':
      return `El bloque ${n.gain || '(sin ganancia)'}`;
    case 'sum':
      return 'El sumador';
    case 'pickoff':
      return 'El nodo de bifurcación';
    case 'source':
      return `La entrada ${n.label}`;
    case 'sink':
      return `La salida ${n.label}`;
  }
};

export function validate(d: Diagram): Issue[] {
  const issues: Issue[] = [];
  const err = (
    code: string,
    message: string,
    nodes: NodeId[] = [],
    edges: string[] = [],
    fix?: Issue['fix'],
  ) => issues.push({ level: 'error', code, message, nodes, edges, ...(fix ? { fix } : {}) });
  const warn = (code: string, message: string, nodes: NodeId[] = [], edges: string[] = []) =>
    issues.push({ level: 'warning', code, message, nodes, edges });

  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const outOf = new Map<NodeId, DiagramEdge[]>();
  const inTo = new Map<NodeId, DiagramEdge[]>();
  for (const e of d.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) {
      err('edge-dangling', 'Hay una conexión que apunta a un elemento que ya no existe.', [], [e.id]);
      continue;
    }
    (outOf.get(e.from) ?? outOf.set(e.from, []).get(e.from)!).push(e);
    (inTo.get(e.to) ?? inTo.set(e.to, []).get(e.to)!).push(e);
  }

  const sources = d.nodes.filter((n) => n.kind === 'source');
  const sinks = d.nodes.filter((n) => n.kind === 'sink');
  if (sources.length === 0) err('no-source', 'Agrega una entrada.');
  if (sources.length > 1)
    err('many-sources', `Hay ${sources.length} entradas; debe haber exactamente una.`, sources.map((n) => n.id));
  if (sinks.length === 0) err('no-sink', 'Agrega una salida.');
  if (sinks.length > 1)
    err('many-sinks', `Hay ${sinks.length} salidas; debe haber exactamente una.`, sinks.map((n) => n.id));

  const declared = new Set(d.symbols.map((s) => s.name));

  for (const n of d.nodes) {
    const ins = inTo.get(n.id) ?? [];
    const outs = outOf.get(n.id) ?? [];

    if (n.kind === 'block') {
      if (!n.gain.trim()) err('block-no-gain', 'Un bloque no tiene ganancia asignada.', [n.id]);
      else {
        try {
          parseGain(n.gain);
          for (const s of gainSymbols(n.gain)) {
            if (!declared.has(s)) {
              err('symbol-undeclared', `${s} no está definido.`, [n.id], [], {
                kind: 'declare-symbol',
                symbol: s,
              });
            }
          }
        } catch (e) {
          err('gain-parse', `${label(n)} tiene una ganancia que no se puede leer: ${(e as Error).message}`, [n.id]);
        }
      }
      if (ins.length === 0) err('block-no-input', `${label(n)} no tiene entrada.`, [n.id]);
      if (ins.length > 1)
        err('block-many-inputs', `${label(n)} tiene ${ins.length} entradas; un bloque solo admite una. Usa un sumador.`, [n.id], ins.map((e) => e.id));
      if (outs.length === 0) err('block-no-output', `${label(n)} no tiene salida.`, [n.id]);
      if (outs.length > 1)
        err('block-many-outputs', `${label(n)} tiene ${outs.length} salidas; agrega un nodo de bifurcación.`, [n.id], outs.map((e) => e.id));
      if (ins.length === 1 && outs.length === 1 && ins[0]!.from === outs[0]!.to) {
        err('block-self-loop', 'Un bloque no puede realimentarse a sí mismo.', [n.id], [ins[0]!.id, outs[0]!.id]);
      }
    }

    if (n.kind === 'sum') {
      if (n.ports.length < 2) err('sum-few-ports', 'El sumador necesita al menos dos puertos de entrada.', [n.id]);
      for (const p of n.ports) {
        if (!ins.some((e) => e.toPort === p.id)) {
          err('sum-free-port', `El sumador tiene un puerto libre (${p.sign === 1 ? '+' : '−'}).`, [n.id]);
        }
      }
      for (const e of ins) {
        if (!e.toPort || !n.ports.some((p) => p.id === e.toPort)) {
          err('sum-edge-no-port', 'Una conexión al sumador no indica en qué puerto entra.', [n.id], [e.id]);
        }
      }
      if (outs.length === 0) err('sum-no-output', 'El sumador no tiene salida.', [n.id]);
      if (outs.length > 1)
        err('sum-many-outputs', 'El sumador tiene más de una salida; agrega un nodo de bifurcación.', [n.id], outs.map((e) => e.id));
    }

    if (n.kind === 'pickoff') {
      if (ins.length !== 1)
        err('pickoff-inputs', `${label(n)} debe tener exactamente una entrada (tiene ${ins.length}).`, [n.id]);
      if (outs.length < 2)
        warn('pickoff-one-output', 'Un nodo de bifurcación con una sola salida no hace nada.', [n.id]);
    }

    if (n.kind === 'source') {
      if (outs.length === 0) err('source-no-output', `${label(n)} no está conectada a nada.`, [n.id]);
      if (outs.length > 1)
        err('source-many-outputs', `${label(n)} tiene varias salidas; agrega un nodo de bifurcación.`, [n.id], outs.map((e) => e.id));
      if (ins.length > 0) err('source-has-input', `${label(n)} no puede recibir señal.`, [n.id], ins.map((e) => e.id));
    }

    if (n.kind === 'sink') {
      if (ins.length === 0) err('sink-no-input', `${label(n)} no recibe nada.`, [n.id]);
      if (ins.length > 1)
        err('sink-many-inputs', `${label(n)} recibe ${ins.length} señales; súmalas con un sumador.`, [n.id], ins.map((e) => e.id));
    }

    if (ins.length === 0 && outs.length === 0 && n.kind !== 'source' && n.kind !== 'sink') {
      warn('isolated', `${label(n)} está suelto en el lienzo.`, [n.id]);
    }
  }

  if (sources.length === 1 && sinks.length === 1) {
    const seen = new Set<NodeId>([sources[0]!.id]);
    const queue = [sources[0]!.id];
    while (queue.length) {
      for (const e of outOf.get(queue.pop()!) ?? []) {
        if (!seen.has(e.to)) {
          seen.add(e.to);
          queue.push(e.to);
        }
      }
    }
    if (!seen.has(sinks[0]!.id)) {
      err('no-path', 'La entrada no llega a la salida.', [sources[0]!.id, sinks[0]!.id]);
    }
  }

  const used = new Set<string>();
  for (const n of d.nodes) if (n.kind === 'block') for (const s of gainSymbols(n.gain)) used.add(s);
  for (const s of d.symbols) {
    if (!used.has(s.name)) warn('symbol-unused', `${s.name} está declarado pero no se usa.`);
  }

  return issues;
}

export const hasErrors = (issues: readonly Issue[]): boolean => issues.some((i) => i.level === 'error');
