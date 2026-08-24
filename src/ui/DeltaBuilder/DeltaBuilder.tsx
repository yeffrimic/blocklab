import type { DeltaBreakdown, MasonResult } from '../../engine/mason.ts';
import type { WeightedWalk } from '../../engine/sfg/types.ts';
import * as P from '../../engine/polynomial/polynomial.ts';
import { useDiagram, type Highlight } from '../../store/useDiagram.ts';
import { Math } from '../Math.tsx';

/** Nodos y aristas del diagrama original que corresponden a un recorrido del SFG. */
function walkHighlight(walk: WeightedWalk): Highlight {
  const nodes = new Set(walk.nodes);
  const edges = new Set<string>();
  for (const e of walk.edges) {
    for (const id of e.via.edges) edges.add(id);
    for (const b of e.via.blocks) nodes.add(b);
  }
  return { nodes, edges };
}

const union = (walks: WeightedWalk[]): Highlight => {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const w of walks) {
    const h = walkHighlight(w);
    for (const n of h.nodes) nodes.add(n);
    for (const e of h.edges) edges.add(e);
  }
  return { nodes, edges };
};

const loopName = (i: number) => `L_{${i + 1}}`;

function Term({
  tex,
  hover,
  title,
}: {
  tex: string;
  hover: Highlight;
  title: string;
}) {
  const setHighlight = useDiagram((s) => s.setHighlight);
  return (
    <span
      className="term"
      title={title}
      onMouseEnter={() => setHighlight(hover)}
      onMouseLeave={() => setHighlight(null)}
    >
      <Math tex={tex} />
    </span>
  );
}

function Breakdown({ delta, loops, label }: { delta: DeltaBreakdown; loops: WeightedWalk[]; label: string }) {
  if (!delta.terms.length) {
    return (
      <p className="delta-line">
        <Math tex={`${label} = 1`} />
        <span className="hint"> — ningún lazo lo toca.</span>
      </p>
    );
  }
  return (
    <div className="delta-line">
      <Math tex={`${label} = `} />
      <span className="term static">
        <Math tex="1" />
      </span>
      {delta.terms.map((t, k) => {
        const involved = t.loopIndices.map((i) => loops[i]!);
        const names = t.loopIndices.map(loopName).join(' ');
        const body = P.toLatex(t.value);
        const sign = body.startsWith('-') ? '-' : '+';
        const tex = sign === '-' ? body.slice(1).trim() : body;
        return (
          <span key={k} className="term-wrap">
            <Math tex={sign} />
            <Term
              tex={tex}
              hover={union(involved)}
              title={
                t.size === 1
                  ? `Lazo ${t.loopIndices[0]! + 1}`
                  : `Producto de ${t.size} lazos no adyacentes: ${t.loopIndices.map((i) => i + 1).join(', ')}`
              }
            />
            <span className="term-label">
              <Math tex={names} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * El panel distintivo: Δ construido término por término, cada uno etiquetado con
 * el lazo que lo originó y resaltándolo en el lienzo al pasar el cursor.
 */
export function DeltaBuilder({ result }: { result: MasonResult }) {
  const setHighlight = useDiagram((s) => s.setHighlight);
  const { loops, paths, pathDeltas, delta } = result;

  return (
    <div className="delta-builder" onMouseLeave={() => setHighlight(null)}>
      <h3>Caminos directos ({paths.length})</h3>
      <ul className="walks">
        {paths.map((p, i) => (
          <li
            key={i}
            onMouseEnter={() => setHighlight(walkHighlight(p))}
            onMouseLeave={() => setHighlight(null)}
          >
            <Math tex={`P_{${i + 1}} = ${P.toLatex(p.gain)}`} />
            <span className="dk">
              <Math tex={`\\Delta_{${i + 1}} = ${P.toLatex(pathDeltas[i]!.value)}`} />
            </span>
          </li>
        ))}
        {!paths.length && <li className="hint">Ninguno.</li>}
      </ul>

      <h3>Lazos ({loops.length})</h3>
      <ul className="walks">
        {loops.map((l, i) => (
          <li
            key={i}
            onMouseEnter={() => setHighlight(walkHighlight(l))}
            onMouseLeave={() => setHighlight(null)}
          >
            <Math tex={`${loopName(i)} = ${P.toLatex(l.gain)}`} />
            <span className="dk hint">{l.nodes.length} nodo{l.nodes.length === 1 ? '' : 's'}</span>
          </li>
        ))}
        {!loops.length && <li className="hint">Ninguno: el sistema es de lazo abierto.</li>}
      </ul>

      <h3>Construcción de Δ</h3>
      <Breakdown delta={delta} loops={loops} label="\Delta" />

      {paths.length > 0 && (
        <>
          <h3>Δ de cada camino</h3>
          {pathDeltas.map((dk, i) => (
            <Breakdown key={i} delta={dk} loops={loops} label={`\\Delta_{${i + 1}}`} />
          ))}
        </>
      )}
    </div>
  );
}
